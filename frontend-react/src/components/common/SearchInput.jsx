import { Search } from "lucide-react";

export default function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
      <input
        className="form-control pl-10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
