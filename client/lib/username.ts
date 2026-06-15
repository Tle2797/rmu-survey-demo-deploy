const THAI_CHARACTERS_REGEX = /[\u0E00-\u0E7F]/;
const THAI_CHARACTERS_GLOBAL_REGEX = /[\u0E00-\u0E7F]/g;

export const USERNAME_THAI_VALIDATION_MESSAGE =
  "username must not contain Thai characters";

export function containsThaiCharacters(value: string) {
  return THAI_CHARACTERS_REGEX.test(value);
}

export function sanitizeUsernameInput(value: string) {
  return value.replace(THAI_CHARACTERS_GLOBAL_REGEX, "");
}
