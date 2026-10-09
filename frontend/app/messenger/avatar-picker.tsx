const presets = ["sky", "fern", "sun", "clay"] as const;

export function AvatarPicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <fieldset className="avatar-picker" disabled={disabled}><legend>Choose an avatar</legend>
    <div className="avatars">{presets.map(key => <label key={key} className="avatar-choice">
      <input type="radio" name="avatar" value={key} checked={value === key} onChange={() => onChange(key)} />
      <img src={"/avatars/" + key + ".svg"} width="44" height="44" alt="" />
      <span>{key[0].toUpperCase() + key.slice(1)}</span>
    </label>)}</div>
  </fieldset>;
}
