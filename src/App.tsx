import React from "react";
import Container from "./components/layout/Container";
import MenuLeft from "./components/layout/MenuLeft";
import MenuRight from "./components/layout/MenuRight";
import ThemeToggle from "./components/ui/ThemeToggle";
import HelpButton from "./components/ui/HelpButton";
import Footer from "./components/ui/Footer";
import { Toaster } from "react-hot-toast";

const App: React.FC = () => {
  return (
    <Container>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#333",
            color: "#fff",
          },
        }}
      />
      <HelpButton />
      <ThemeToggle />
      <MenuLeft />
      <MenuRight />
      <Footer />
    </Container>
  );
};

export default App;
