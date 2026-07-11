export type QuestionType = 'short-text' | 'long-text' | 'number' | 'checkbox' | 'radio' | 'scale' | 'header';

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: string[]; // np. "Opcja 1", "Opcja 2" dla radio/checkbox
  customAnswer?: boolean; // pole "własna odpowiedź" dla radio/checkbox
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  description?: string; // objaśnienie pod pytaniem lub podtytuł dla nagłówka
  colorTag?: string; // ręcznie przypisany kolor powiązania (hex), widoczny gdy włączono "Samodzielne powiązanie"
  logic?: {
    strategy: 'all' | 'any';
    conditions: {
      id: string;
      fieldId: string;
      operator: 'empty' | 'not-empty' | 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater' | 'less';
      value?: string;
    }[];
  };
}

export interface SurveySchema {
  header?: string;
  description?: string;
  questions: Question[];
  theme?: 'light' | 'dark'; // motyw strony publicznej ankiety
  buttonColor?: string; // kolor przycisków na stronie publicznej ankiety (hex)
  submitBtnText?: string;
  submitBtnSize?: 'small' | 'medium' | 'large';
  submitBtnAlign?: 'left' | 'right' | 'center' | 'full';
  emailNotifications?: boolean;
  oneQuestionPerPage?: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  schema_json: string;
  views: number;
  submissions: number;
  redirect_url: string | null;
  webhook_url: string | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  answers_json: string;
  created_at: string;
}
