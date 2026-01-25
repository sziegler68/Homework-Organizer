import { useState } from 'react';
import SetupView from './components/SetupView';
import CaptureView from './components/CaptureView';
import './index.css';

function App() {
  const [step, setStep] = useState('setup'); // 'setup' | 'capture'
  const [meta, setMeta] = useState(null);

  const handleStart = (formData) => {
    setMeta(formData);
    setStep('capture');
  };

  const handleReset = () => {
    setMeta(null);
    setStep('setup');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">HW Organizer</h1>
        <p className="app-subtitle">Snap, name, and zip your homework</p>
      </header>

      {step === 'setup' && <SetupView onStart={handleStart} />}
      {step === 'capture' && <CaptureView meta={meta} onReset={handleReset} />}
    </div>
  );
}

export default App;
