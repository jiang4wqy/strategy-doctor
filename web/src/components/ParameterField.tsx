export interface ParameterFieldProps {
  id: string;
  label: string;
  description: string;
  kind: 'integer' | 'number';
  value: string;
  onChange(value: string): void;
}

export function ParameterField({
  id,
  label,
  description,
  kind,
  value,
  onChange,
}: ParameterFieldProps) {
  return (
    <div className="parameter-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        step={kind === 'integer' ? 1 : 'any'}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      <small>{description}</small>
    </div>
  );
}
