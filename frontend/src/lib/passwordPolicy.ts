/** Mirrors the backend PASSWORD_MIN_LENGTH (default 12). One place for the reset form and the profile form. */
export const PASSWORD_MIN_LENGTH = Number(process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH || 12);
