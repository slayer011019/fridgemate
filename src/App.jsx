import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/AppShell';
import HomePage from './pages/HomePage';
import IngredientsPage from './pages/IngredientsPage';
import IngredientFormPage from './pages/IngredientFormPage';
import ImportPage from './pages/ImportPage';
import RecipesPage from './pages/RecipesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AccountPage from './pages/AccountPage';
import { isOcrEnabled } from './utils/backendConfig';

function App() {
  const ocrEnabled = isOcrEnabled();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/ingredients/new" element={<IngredientFormPage />} />
        <Route path="/ingredients/:ingredientId/edit" element={<IngredientFormPage />} />
        <Route path="/import" element={ocrEnabled ? <ImportPage /> : <Navigate to="/" replace />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppShell>
  );
}

export default App;
