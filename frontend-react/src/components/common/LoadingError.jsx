import { AlertCircle, RefreshCw } from "lucide-react";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import Spinner from "./Spinner.jsx";

export function LoadingState({ label = "Loading data..." }) {
  return (
    <Card className="grid min-h-40 place-items-center">
      <Spinner label={label} />
    </Card>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card className="flex flex-col items-start gap-3 border-rose-200 bg-rose-50/60 sm:flex-row sm:items-center">
      <AlertCircle aria-hidden="true" className="shrink-0 text-rose-600" size={20} />
      <div className="flex-1">
        <p className="font-semibold text-rose-900">Could not load this page</p>
        <p className="mt-1 text-sm text-rose-800">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          <RefreshCw aria-hidden="true" size={16} />
          Retry
        </Button>
      )}
    </Card>
  );
}
