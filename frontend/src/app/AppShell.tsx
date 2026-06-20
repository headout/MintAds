import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import headoutLogo from '../assets/logo/headout.svg';
import { Icon } from '../components/ui/Icon';
import styles from './AppShell.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${styles.navLink} t-cta-sm${isActive ? ` ${styles.navLinkActive}` : ''}`;

export function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className={styles.sidebar} aria-label="Sidebar navigation">
        <div className={styles.brand}>
          <img className={styles.logo} src={headoutLogo} alt="Headout" />
          <span className={`${styles.brandLabel} t-cta-sm`}>MintAds</span>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          <NavLink to="/" end className={navClass}>
            <Icon name="plus" size={18} />
            <span>Create New</span>
          </NavLink>
          <NavLink to="/history" className={navClass}>
            <Icon name="clapperboard" size={18} />
            <span>Library</span>
          </NavLink>
        </nav>
      </aside>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
