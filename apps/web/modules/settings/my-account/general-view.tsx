"use client";

import { revalidateSettingsGeneral } from "app/(use-page-wrapper)/settings/(settings-layout)/my-account/general/actions";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { TimezoneSelect } from "@calcom/features/components/timezone-select";
import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { formatLocalizedDateTime } from "@calcom/lib/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { localeOptions } from "@calcom/lib/i18n";
import { nameOfDay } from "@calcom/lib/weekday";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Button } from "@calcom/ui/components/button";
import { Form } from "@calcom/ui/components/form";
import { Label } from "@calcom/ui/components/form";
import { Select } from "@calcom/ui/components/form";
import { SettingsToggle } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { revalidateTravelSchedules } from "@calcom/web/app/cache/travelSchedule";

import TravelScheduleModal from "@components/settings/TravelScheduleModal";

export type FormValues = {
  locale: {
    value: string;
    label: string;
  };
  timeZone: string;
  timeFormat: {
    value: number;
    label: string | number;
  };
  weekStart: {
    value: string;
    label: string;
  };
  travelSchedules: {
    id?: number;
    startDate: Date;
    endDate?: Date;
    timeZone: string;
  }[];
};

interface GeneralViewProps {
  user: RouterOutputs["viewer"]["me"]["get"];
  travelSchedules: RouterOutputs["viewer"]["travelSchedules"]["get"];
}

const GeneralView = ({ user, travelSchedules }: GeneralViewProps) => {
  const localeProp = user.locale ?? "en";
  const utils = trpc.useContext();
  const {
    t,
    i18n: { language },
  } = useLocale();
  const { update } = useSession();
  const [isUpdateBtnLoading, setIsUpdateBtnLoading] = useState<boolean>(false);
  const [isTZScheduleOpen, setIsTZScheduleOpen] = useState<boolean>(false);

  const mutation = trpc.viewer.me.updateProfile.useMutation({
    onSuccess: async (res) => {
      await utils.viewer.me.invalidate();
      revalidateSettingsGeneral();
      revalidateTravelSchedules();
      reset(getValues());
      showToast(t("settings_updated_successfully"), "success");
      await update(res);

      if (res.locale) {
        window.calNewLocale = res.locale;
        document.cookie = `calNewLocale=${res.locale}; path=/`;
      }
    },
    onError: () => {
      showToast(t("error_updating_settings"), "error");
    },
    onSettled: async () => {
      await utils.viewer.me.invalidate();
      revalidateSettingsGeneral();
      revalidateTravelSchedules();
      setIsUpdateBtnLoading(false);
    },
  });

  const timeFormatOptions = [
    { value: 12, label: t("12_hour") },
    { value: 24, label: t("24_hour") },
  ];

  const weekStartOptions = [
    { value: "Sunday", label: nameOfDay(localeProp, 0) },
    { value: "Monday", label: nameOfDay(localeProp, 1) },
    { value: "Tuesday", label: nameOfDay(localeProp, 2) },
    { value: "Wednesday", label: nameOfDay(localeProp, 3) },
    { value: "Thursday", label: nameOfDay(localeProp, 4) },
    { value: "Friday", label: nameOfDay(localeProp, 5) },
    { value: "Saturday", label: nameOfDay(localeProp, 6) },
  ];

  const formMethods = useForm<FormValues>({
    defaultValues: {
      locale: {
        value: localeProp || "",
        label: localeOptions.find((option) => option.value === localeProp)?.label || "",
      },
      timeZone: user.timeZone || "",
      timeFormat: {
        value: user.timeFormat || 12,
        label: timeFormatOptions.find((option) => option.value === user.timeFormat)?.label || 12,
      },
      weekStart: {
        value: user.weekStart,
        label: nameOfDay(localeProp, user.weekStart === "Sunday" ? 0 : 1),
      },
      travelSchedules:
        travelSchedules.map((schedule) => {
          return {
            id: schedule.id,
            startDate: schedule.startDate,
            endDate: schedule.endDate ?? undefined,
            timeZone: schedule.timeZone,
          };
        }) || [],
    },
  });
  const {
    formState: { isDirty, isSubmitting },
    reset,
    getValues,
  } = formMethods;
  const isDisabled = isSubmitting || !isDirty;

  const [isAllowDynamicBookingChecked, setIsAllowDynamicBookingChecked] = useState(
    !!user.allowDynamicBooking
  );
  const [isAllowSEOIndexingChecked, setIsAllowSEOIndexingChecked] = useState(
    user.organizationSettings?.allowSEOIndexing === false
      ? !!user.organizationSettings?.allowSEOIndexing
      : !!user.allowSEOIndexing
  );
  const [isReceiveMonthlyDigestEmailChecked, setIsReceiveMonthlyDigestEmailChecked] = useState(
    !!user.receiveMonthlyDigestEmail
  );

  const watchedTzSchedules = formMethods.watch("travelSchedules");

  return (
    <SettingsHeader title={t("general")} description={t("general_description")} borderInShellHeader={true}>
      <div>
        <Form
          form={formMethods}
          handleSubmit={async (values) => {
            setIsUpdateBtnLoading(true);
            mutation.mutate({
              ...values,
              locale: values.locale.value,
              timeFormat: values.timeFormat.value,
              weekStart: values.weekStart.value,
            });
          }}>
          <div className="border-subtle border-x border-y-0 px-4 py-8 sm:px-6">
            <Controller
              name="locale"
              render={({ field: { value, onChange } }) => (
                <>
                  <Label className="text-emphasis">
                    <>{t("language")}</>
                  </Label>
                  <Select<{ label: string; value: string }>
                    className="capitalize"
                    options={localeOptions}
                    value={value}
                    onChange={onChange}
                  />
                </>
              )}
            />
            <Controller
              name="timeZone"
              control={formMethods.control}
              render={({ field: { value } }) => (
                <>
                  <Label className="text-emphasis mt-6">
                    <>{t("timezone")}</>
                  </Label>
                  <TimezoneSelect
                    id="timezone"
                    value={value}
                    onChange={(event) => {
                      if (event) formMethods.setValue("timeZone", event.value, { shouldDirty: true });
                    }}
                  />
                </>
              )}
            />
            {!watchedTzSchedules.length ? (
              <Button
                color="secondary"
                className="mt-2"
                StartIcon="calendar"
                onClick={() => setIsTZScheduleOpen(true)}>
                {t("schedule_timezone_change")}
              </Button>
            ) : (
              <div className="bg-muted border-subtle mt-2 rounded-md border p-4">
                <Label>{t("travel_schedule")}</Label>
                <div className="border-subtle bg-default mt-4 rounded-md border text-sm">
                  {watchedTzSchedules.map((schedule, index) => {
                    return (
                      <div
                        className={classNames(
                          "flex items-center p-4",
                          index !== 0 ? "border-subtle border-t" : ""
                        )}
                        key={index}>
                        <div>
                          <div className="text-emphasis font-semibold">{`${formatLocalizedDateTime(
                            schedule.startDate,
                            { day: "numeric", month: "long" },
                            language
                          )} ${
                            schedule.endDate
                              ? `- ${formatLocalizedDateTime(
                                  schedule.endDate,
                                  { day: "numeric", month: "long" },
                                  language
                                )}`
                              : ``
                          }`}</div>
                          <div className="text-subtle">{schedule.timeZone.replace(/_/g, " ")}</div>
                        </div>
                        <Button
                          color="secondary"
                          className="ml-auto"
                          variant="icon"
                          StartIcon="trash-2"
                          onClick={() => {
                            const updatedSchedules = watchedTzSchedules.filter(
                              (s, filterIndex) => filterIndex !== index
                            );
                            formMethods.setValue("travelSchedules", updatedSchedules, { shouldDirty: true });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <Button
                  StartIcon="plus"
                  color="secondary"
                  className="mt-4"
                  onClick={() => setIsTZScheduleOpen(true)}>
                  {t("add")}
                </Button>
              </div>
            )}

            <Controller
              name="timeFormat"
              control={formMethods.control}
              render={({ field: { value } }) => (
                <>
                  <Label className="text-emphasis mt-6">
                    <>{t("time_format")}</>
                  </Label>
                  <Select
                    value={value}
                    options={timeFormatOptions}
                    onChange={(event) => {
                      if (event) formMethods.setValue("timeFormat", { ...event }, { shouldDirty: true });
                    }}
                  />
                </>
              )}
            />
            <div className="text-gray text-subtle mt-2 flex items-center text-xs">
              {t("timeformat_profile_hint")}
            </div>
            <Controller
              name="weekStart"
              control={formMethods.control}
              render={({ field: { value } }) => (
                <>
                  <Label className="text-emphasis mt-6">
                    <>{t("start_of_week")}</>
                  </Label>
                  <Select
                    value={value}
                    options={weekStartOptions}
                    onChange={(event) => {
                      if (event) formMethods.setValue("weekStart", { ...event }, { shouldDirty: true });
                    }}
                  />
                </>
              )}
            />
          </div>

          <SectionBottomActions align="end">
            <Button
              loading={isUpdateBtnLoading}
              disabled={isDisabled}
              color="primary"
              type="submit"
              data-testid="general-submit-button">
              <>{t("update")}</>
            </Button>
          </SectionBottomActions>
        </Form>

        <SettingsToggle
          toggleSwitchAtTheEnd={true}
          title={t("dynamic_booking")}
          description={t("allow_dynamic_booking")}
          disabled={mutation.isPending}
          checked={isAllowDynamicBookingChecked}
          onCheckedChange={(checked) => {
            setIsAllowDynamicBookingChecked(checked);
            mutation.mutate({ allowDynamicBooking: checked });
          }}
          switchContainerClassName="mt-6"
        />

        <SettingsToggle
          data-testid="my-seo-indexing-switch"
          toggleSwitchAtTheEnd={true}
          title={t("seo_indexing")}
          description={t("allow_seo_indexing")}
          disabled={mutation.isPending || user.organizationSettings?.allowSEOIndexing === false}
          checked={isAllowSEOIndexingChecked}
          onCheckedChange={(checked) => {
            setIsAllowSEOIndexingChecked(checked);
            mutation.mutate({ allowSEOIndexing: checked });
          }}
          switchContainerClassName="mt-6"
        />

        <SettingsToggle
          toggleSwitchAtTheEnd={true}
          title={t("monthly_digest_email")}
          description={t("monthly_digest_email_for_teams")}
          disabled={mutation.isPending}
          checked={isReceiveMonthlyDigestEmailChecked}
          onCheckedChange={(checked) => {
            setIsReceiveMonthlyDigestEmailChecked(checked);
            mutation.mutate({ receiveMonthlyDigestEmail: checked });
          }}
          switchContainerClassName="mt-6"
        />
        <TravelScheduleModal
          open={isTZScheduleOpen}
          onOpenChange={() => setIsTZScheduleOpen(false)}
          setValue={formMethods.setValue}
          existingSchedules={formMethods.getValues("travelSchedules") ?? []}
        />
      </div>
    </SettingsHeader>
  );
};

export default GeneralView;
