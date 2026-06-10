import styles from "./ModelSeriesIcon.module.css";

type ModelSeriesIconProps = {
  modelName: string;
  modelSeries?: string;
};

export function ModelSeriesIcon({ modelName, modelSeries }: ModelSeriesIconProps) {
  const label = (modelSeries || modelName || "?").slice(0, 1).toUpperCase();

  return (
    <span aria-hidden className={styles.icon}>
      {label}
    </span>
  );
}
