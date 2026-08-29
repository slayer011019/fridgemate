import AppShell from './components/AppShell';
import AppRoutes from './components/AppRoutes';
import AboutPage from './pages/AboutPage';
import AccountPage from './pages/AccountPage';
import ContactPage from './pages/ContactPage';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import IngredientFormPage from './pages/IngredientFormPage';
import IngredientsPage from './pages/IngredientsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPage from './pages/PrivacyPage';
import PublicRecipePage from './pages/PublicRecipePage';
import RecipesPage from './pages/RecipesPage';
import SignupPage from './pages/SignupPage';
import { isOcrEnabled } from './utils/backendConfig';

const pages = {
  AboutPage,
  AccountPage,
  ContactPage,
  HomePage,
  ImportPage,
  IngredientFormPage,
  IngredientsPage,
  LoginPage,
  NotFoundPage,
  PrivacyPage,
  PublicRecipePage,
  RecipesPage,
  SignupPage
};

function AppServer() {
  return (
    <AppShell>
      <AppRoutes pages={pages} ocrEnabled={isOcrEnabled()} />
    </AppShell>
  );
}

export default AppServer;
