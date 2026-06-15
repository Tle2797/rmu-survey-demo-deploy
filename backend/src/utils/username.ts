const THAI_CHARACTERS_REGEX = /[\u0E00-\u0E7F]/;

export const USERNAME_THAI_VALIDATION_MESSAGE =
  "username must not contain Thai characters";

export function containsThaiCharacters(value: string) {
  return THAI_CHARACTERS_REGEX.test(value);
}
