import './App.css';
import DocumentPage from './pages/DocumentPage';
import { LanguageProvider } from './i18n/i18n';

function App() {
  return (
    <LanguageProvider>
      <DocumentPage />
    </LanguageProvider>
  );
}

export default App;
