import React from 'react';
import Container from './components/layout/Container';
import MenuLeft from './components/layout/MenuLeft';
import MenuRight from './components/layout/MenuRight';
import ThemeToggle from './components/ui/ThemeToggle';

const App: React.FC = () => {
  return (
    <Container>
      <ThemeToggle />
      <MenuLeft />
      <MenuRight />
    </Container>
  );
};

export default App;