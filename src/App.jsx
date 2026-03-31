import { Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import HomePage from './pages/HomePage';
import IngredientsPage from './pages/IngredientsPage';
import IngredientFormPage from './pages/IngredientFormPage';
import ImportPage from './pages/ImportPage';
import RecipesPage from './pages/RecipesPage';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/ingredients/new" element={<IngredientFormPage />} />
        <Route path="/ingredients/:ingredientId/edit" element={<IngredientFormPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
