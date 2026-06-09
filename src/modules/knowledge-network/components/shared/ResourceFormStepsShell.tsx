import { LeftOutlined } from "@ant-design/icons";
import { Steps } from "antd";
import type { ReactNode } from "react";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./ResourceFormStepsShell.module.css";

type StepAction = {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  text: string;
};

type ResourceFormStepsShellProps = {
  actions?: {
    cancel?: StepAction;
    next?: StepAction;
    prev?: StepAction;
    save?: StepAction;
  };
  children: ReactNode;
  currentStep: number;
  doneStep: number;
  onBack: () => void;
  onStepChange?: (step: number) => void;
  steps: Array<{ title: string }>;
  title: string;
};

export function ResourceFormStepsShell({
  actions,
  children,
  currentStep,
  doneStep,
  onBack,
  onStepChange,
  steps,
  title,
}: ResourceFormStepsShellProps) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            aria-label="back"
            className={styles.backButton}
            onClick={onBack}
            type="button"
          >
            <LeftOutlined />
          </button>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.headerCenter}>
          <Steps
            className={styles.steps}
            current={currentStep}
            items={steps}
            onChange={(nextStep) => {
              if (nextStep <= doneStep) {
                onStepChange?.(nextStep);
              }
            }}
            size="small"
          />
        </div>
        <div className={styles.headerActions}>
          {actions?.prev ? (
            <AppButton
              disabled={actions.prev.disabled}
              loading={actions.prev.loading}
              onClick={actions.prev.onClick}
            >
              {actions.prev.text}
            </AppButton>
          ) : null}
          {actions?.next ? (
            <AppButton
              disabled={actions.next.disabled}
              loading={actions.next.loading}
              onClick={actions.next.onClick}
              type="primary"
            >
              {actions.next.text}
            </AppButton>
          ) : null}
          {actions?.save ? (
            <AppButton
              disabled={actions.save.disabled}
              loading={actions.save.loading}
              onClick={actions.save.onClick}
              type="primary"
            >
              {actions.save.text}
            </AppButton>
          ) : null}
          {actions?.cancel ? (
            <AppButton
              disabled={actions.cancel.disabled}
              loading={actions.cancel.loading}
              onClick={actions.cancel.onClick}
            >
              {actions.cancel.text}
            </AppButton>
          ) : null}
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
