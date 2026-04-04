import { getCurrentUser, loginUser, signupUser } from '../services/authService.js';

export async function signupHandler(request, response, next) {
  try {
    const session = await signupUser(request.body);
    response.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(request, response, next) {
  try {
    const session = await loginUser(request.body);
    response.json(session);
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUserHandler(request, response, next) {
  try {
    const user = await getCurrentUser(request.auth.userId);
    response.json(user);
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(_request, response) {
  response.status(204).send();
}
