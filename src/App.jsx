import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/AppShell';
import RouteMetadata from './components/RouteMetadata';
import HomePage from './pages/HomePage';
import IngredientsPage from './pages/IngredientsPage';
import IngredientFormPage from './pages/IngredientFormPage';
import ImportPage from './pages/ImportPage';
import RecipesPage from './pages/RecipesPage';
import PublicRecipePage from './pages/PublicRecipePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AccountPage from './pages/AccountPage';
import PrivacyPage from './pages/PrivacyPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import { isOcrEnabled } from './utils/backendConfig';

function App() {
  const ocrEnabled = isOcrEnabled();

  return (
    <AppShell>
      <RouteMetadata />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/ingredients/new" element={<IngredientFormPage />} />
        <Route path="/ingredients/:ingredientId/edit" element={<IngredientFormPage />} />
        <Route path="/import" element={ocrEnabled ? <ImportPage /> : <Navigate to="/" replace />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:recipeSlug" element={<PublicRecipePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
