import { AccountCard } from '../components/AccountCard';
import { ProfileMemoryPanel } from '../components/ProfileMemoryPanel';

export function ProfilePage() {
  return (
    <section>
      <header className="page-header">
        <span className="eyebrow">YOUR TASTE PROFILE</span>
      </header>
      <AccountCard />
      <ProfileMemoryPanel />
    </section>
  );
}
