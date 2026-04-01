import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { IngredientsProvider } from './hooks/useIngredients';
import { PantryStaplesProvider } from './hooks/usePantryStaples';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PantryStaplesProvider>
        <IngredientsProvider>
          <App />
        </IngredientsProvider>
      </PantryStaplesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
