export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  referralCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** What login/register/refresh return alongside the Set-Cookie headers — tokens themselves never appear in the JSON body. */
export interface AuthResultDto {
  user: import("@/modules/identity/dto/user.dto").UserResponseDto;
}
