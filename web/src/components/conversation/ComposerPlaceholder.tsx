import styles from './ComposerPlaceholder.module.css';

export function ComposerPlaceholder() {
  return (
    <div className={styles.composer} aria-disabled="true">
      <div className={styles.inputPlaceholder}>
        Message...
      </div>
    </div>
  );
}
