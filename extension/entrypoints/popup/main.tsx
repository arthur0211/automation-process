import { render } from 'preact';
import { Popup } from './Popup';
import { ErrorBoundary } from '../sidepanel/components/ErrorBoundary';
import './style.css';

render(
  <ErrorBoundary>
    <Popup />
  </ErrorBoundary>,
  document.getElementById('app')!,
);
