import styles from './UserIdentity.module.css';

interface UserIdentityProps {
  username: string;
}

export function UserIdentity({ username }: UserIdentityProps) {
  // Take first 2 characters for a simple avatar
  const initials = username.substring(0, 2).toUpperCase();

  return (
    <div className={styles.container}>
      <div className={styles.avatar} aria-hidden="true">
        {initials}
      </div>
      <div className={styles.details}>
        <div className={styles.name}>{username}</div>
        <div className={styles.status}>Authenticated</div>
      </div>
    </div>
  );
}
