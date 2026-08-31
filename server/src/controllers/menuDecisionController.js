import {
  cancelMenuDecision,
  completeMenuDecision,
  getMenuDecision,
  selectMenuDecision
} from '../services/menuDecisionService.js';

export async function getMenuDecisionHandler(request, response, next) {
  try {
    response.json(await getMenuDecision(request.auth.userId, request.query.date));
  } catch (error) {
    next(error);
  }
}

export async function selectMenuDecisionHandler(request, response, next) {
  try {
    response.json(await selectMenuDecision(request.auth.userId, request.params.date, request.body));
  } catch (error) {
    next(error);
  }
}

export async function completeMenuDecisionHandler(request, response, next) {
  try {
    response.json(await completeMenuDecision(request.auth.userId, request.params.date, request.body));
  } catch (error) {
    next(error);
  }
}

export async function cancelMenuDecisionHandler(request, response, next) {
  try {
    response.json(await cancelMenuDecision(request.auth.userId, request.params.date, request.body));
  } catch (error) {
    next(error);
  }
}
