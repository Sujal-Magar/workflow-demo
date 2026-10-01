interface FieldErrorProps {
  id: string;
  message?: string;
}

export function FieldError({ id, message }: Readonly<FieldErrorProps>) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-left text-xs leading-4 text-red-600">
      {message}
    </p>
  );
}
