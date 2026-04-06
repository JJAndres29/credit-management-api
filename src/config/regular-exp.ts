export const regularExps = {

  // email
  email: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,

  // Contraseña fuerte: mínimo 8 caracteres, al menos una mayúscula,
  // una minúscula, un número y un carácter especial
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,

}