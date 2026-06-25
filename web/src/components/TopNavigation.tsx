export interface TopNavigationProps {
  currentPath: string;
}

export function TopNavigation({ currentPath }: TopNavigationProps) {
  const isShowcase = currentPath === '/showcase';
  const isTutorial = currentPath === '/tutorial';

  return (
    <header className="top-nav">
      <a href="/" className="top-nav-brand">
        Strategy Doctor
      </a>
      <nav className="top-nav-links" aria-label="Primary navigation">
        {!isShowcase && <a href="/showcase">Public showcase</a>}
        {isShowcase && <a href="/">Workspace</a>}
        {!isTutorial && <a href="/tutorial">Tutorial</a>}
        {isTutorial && <a href="/">Back to workspace</a>}
      </nav>
    </header>
  );
}

