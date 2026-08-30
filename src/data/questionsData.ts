import type { Question } from '../types/questions'
import { QUANT_QUESTIONS } from './questions/quantQuestions'
import { LOGIC_QUESTIONS } from './questions/logicQuestions'
import { DI_QUESTIONS } from './questions/diQuestions'
import { VERBAL_QUESTIONS } from './questions/verbalQuestions'

export const INITIAL_QUESTIONS: Question[] = [
  ...QUANT_QUESTIONS,
  ...LOGIC_QUESTIONS,
  ...DI_QUESTIONS,
  ...VERBAL_QUESTIONS,
]
