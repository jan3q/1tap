import { getSurvey } from '@/app/actions';
import { notFound } from 'next/navigation';
import ShareClient from './ShareClient';
import { SurveySchema } from '@/types';
import { headers } from 'next/headers';
import { getScaleValues } from '@/lib/utils';

function generateFullHTML(survey: any, schema: SurveySchema, baseUrl: string): string {
  const submitUrl = `${baseUrl}/api/s/${survey.id}/submit`;
  
  let fieldsHTML = '';
  schema.questions.forEach((q, idx) => {
    const isRequired = q.required ? 'required' : '';
    const star = q.required ? '<span style="color: #ef4444;">*</span>' : '';
    const desc = q.description ? `<p style="font-size: 0.9rem; color: #6b7280; margin: -0.25rem 0 0.75rem 0;">${q.description}</p>` : '';

    if (q.type === 'header') {
      fieldsHTML += `
      <div class="form-group header-block" id="group-${q.id}" style="margin: 2rem 0 1.5rem 0;">
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.35rem; color: #1a1a1a; border: none; padding: 0;">${q.title || ''}</h2>
        ${q.description ? `<p style="font-size: 0.95rem; color: #6b7280; margin: 0;">${q.description}</p>` : ''}
      </div>`;
      return;
    }

    fieldsHTML += `
      <div class="form-group" id="group-${q.id}" data-type="${q.type}" style="margin-bottom: 2rem; transition: all 0.3s ease;">
        <label style="display: block; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: #1a1a1a;">
          ${q.title || ''} ${star}
        </label>
        ${desc}
    `;

    if (q.type === 'short-text') {
      fieldsHTML += `        <input type="text" name="${q.id}" ${isRequired} placeholder="Twoja odpowiedź..." style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 1rem; outline: none; box-sizing: border-box; transition: border-color 0.2s;" onfocus="this.style.borderColor='#000'" onblur="this.style.borderColor='#e5e7eb'" />`;
    } else if (q.type === 'long-text') {
      fieldsHTML += `        <textarea name="${q.id}" ${isRequired} placeholder="Twoja odpowiedź..." rows="4" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 1rem; outline: none; box-sizing: border-box; transition: border-color 0.2s; resize: vertical;" onfocus="this.style.borderColor='#000'" onblur="this.style.borderColor='#e5e7eb'"></textarea>`;
    } else if (q.type === 'number') {
      fieldsHTML += `        <input type="number" name="${q.id}" ${isRequired} placeholder="Wpisz liczbę..." style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 1rem; outline: none; box-sizing: border-box; transition: border-color 0.2s;" onfocus="this.style.borderColor='#000'" onblur="this.style.borderColor='#e5e7eb'" />`;
    } else if (q.type === 'radio') {
      fieldsHTML += `        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
      q.options?.forEach((opt, optIdx) => {
        fieldsHTML += `
          <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
            <input type="radio" name="${q.id}" value="${opt}" ${idx === 0 && optIdx === 0 ? 'required' : ''} style="accent-color: #000; width: 1.1rem; height: 1.1rem;" />
            <span style="font-size: 1rem; color: #1a1a1a;">${opt}</span>
          </label>`;
      });
      fieldsHTML += `        </div>`;
    } else if (q.type === 'checkbox') {
      fieldsHTML += `        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">`;
      q.options?.forEach((opt) => {
        fieldsHTML += `
          <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" name="${q.id}" value="${opt}" style="accent-color: #000; width: 1.1rem; height: 1.1rem;" />
            <span style="font-size: 1rem; color: #1a1a1a;">${opt}</span>
          </label>`;
      });
      fieldsHTML += `        </div>`;
    } else if (q.type === 'scale') {
      fieldsHTML += `        <div style="display: flex; gap: 0.35rem; margin-top: 0.5rem; flex-wrap: wrap;">`;
      getScaleValues(q).forEach((sVal) => {
        fieldsHTML += `
          <label style="min-width: 40px; height: 40px; padding: 0 0.5rem; display: flex; align-items: center; justify-content: center; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s; box-sizing: border-box;" class="scale-item-${q.id}" onclick="selectScale(event, '${q.id}', '${sVal}')">
            <input type="radio" name="${q.id}" value="${sVal}" style="display: none;" />
            <span style="font-size: 1rem; font-weight: 500;">${sVal}</span>
          </label>`;
      });
      fieldsHTML += `        </div>`;
    }

    fieldsHTML += `      </div>`;
  });

  let logicJS = '';
  schema.questions.forEach((q) => {
    if (!q.logic || !q.logic.conditions || q.logic.conditions.length === 0) return;
    
    const condsArray = q.logic.conditions.map(c => {
      return {
        fieldId: c.fieldId,
        operator: c.operator,
        value: c.value
      };
    });

    logicJS += `      evaluateLogicForField('${q.id}', ${JSON.stringify(condsArray)}, '${q.logic.strategy}');\n`;
  });

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${survey.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7f9fa;
      color: #1a1a1a;
      line-height: 1.5;
      padding: 2rem 1rem;
      margin: 0;
    }
    .onetap-container {
      max-width: 650px;
      margin: 0 auto;
      background: #ffffff;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e5e7eb;
      box-sizing: border-box;
    }
    .onetap-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      background-color: #000000;
      color: #ffffff;
      transition: all 0.2s;
      width: 100%;
      box-sizing: border-box;
    }
    .onetap-btn:hover {
      background-color: #222222;
    }
    .onetap-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .success-message {
      display: none;
      text-align: center;
      padding: 3rem 1rem;
    }
  </style>
</head>
<body>

  <div class="onetap-container" id="onetap-container">
    <form id="onetap-form" onsubmit="submitOneTap(event)">
      ${fieldsHTML}
      <button type="submit" class="onetap-btn" id="submit-btn">Wyślij ankietę</button>
    </form>
    
    <div class="success-message" id="success-message">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; border: none; padding: 0;">Dziękujemy!</h1>
      <p style="color: #6b7280; font-size: 1.1rem; margin: 0;">Twoja odpowiedź została pomyślnie zapisana.</p>
    </div>
  </div>

  <script>
    function selectScale(event, fieldId, value) {
      const items = document.querySelectorAll('.scale-item-' + fieldId);
      items.forEach(el => {
        el.style.backgroundColor = 'transparent';
        el.style.color = '#1a1a1a';
        el.style.borderColor = '#e5e7eb';
      });
      
      const activeEl = event.currentTarget;
      activeEl.style.backgroundColor = '#000000';
      activeEl.style.color = '#ffffff';
      activeEl.style.borderColor = '#000000';
      
      const radio = activeEl.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const changeEvent = new Event('change', { bubbles: true });
        radio.dispatchEvent(changeEvent);
      }
    }

    function getFieldValue(fieldId) {
      const inputs = document.getElementsByName(fieldId);
      if (inputs.length === 0) return '';
      
      if (inputs[0].type === 'radio') {
        for (let i = 0; i < inputs.length; i++) {
          if (inputs[i].checked) return inputs[i].value;
        }
        return '';
      } else if (inputs[0].type === 'checkbox') {
        const checkedValues = [];
        for (let i = 0; i < inputs.length; i++) {
          if (inputs[i].checked) checkedValues.push(inputs[i].value);
        }
        return checkedValues;
      }
      return inputs[0].value;
    }

    function evaluateCondition(cond) {
      const val = getFieldValue(cond.fieldId);
      const answerStr = String(val).toLowerCase();
      const targetStr = String(cond.value).toLowerCase();

      switch (cond.operator) {
        case 'empty':
          return val === '' || (Array.isArray(val) && val.length === 0);
        case 'not-empty':
          return val !== '' && (!Array.isArray(val) || val.length > 0);
        case 'equals':
          if (Array.isArray(val)) {
            return val.map(v => String(v).toLowerCase()).includes(targetStr);
          }
          return answerStr === targetStr;
        case 'not-equals':
          if (Array.isArray(val)) {
            return !val.map(v => String(v).toLowerCase()).includes(targetStr);
          }
          return answerStr !== targetStr;
        case 'contains':
          return answerStr.includes(targetStr);
        case 'not-contains':
          return !answerStr.includes(targetStr);
        case 'greater':
          return Number(val) > Number(cond.value);
        case 'less':
          return Number(val) < Number(cond.value);
        default:
          return true;
      }
    }

    function evaluateLogicForField(qId, conditions, strategy) {
      if (!conditions || conditions.length === 0) return;
      
      let show = true;
      if (strategy === 'all') {
        show = conditions.every(c => evaluateCondition(c));
      } else {
        show = conditions.some(c => evaluateCondition(c));
      }
      
      const container = document.getElementById('group-' + qId);
      if (container) {
        if (show) {
          container.style.display = 'block';
          const inputs = container.querySelectorAll('input, textarea, select');
          inputs.forEach(input => {
            if (input.hasAttribute('data-was-required')) {
              input.setAttribute('required', '');
            }
          });
        } else {
          container.style.display = 'none';
          const inputs = container.querySelectorAll('input, textarea, select');
          inputs.forEach(input => {
            if (input.hasAttribute('required')) {
              input.setAttribute('data-was-required', 'true');
              input.removeAttribute('required');
            }
          });
        }
      }
    }

    function checkAllLogic() {
${logicJS}    }

    document.getElementById('onetap-form').addEventListener('change', checkAllLogic);
    document.getElementById('onetap-form').addEventListener('input', checkAllLogic);
    checkAllLogic();

    async function submitOneTap(e) {
      e.preventDefault();
      const form = e.target;
      const btn = document.getElementById('submit-btn');
      
      btn.disabled = true;
      btn.innerText = 'Wysyłanie...';

      const payload = {};
      const formData = new FormData(form);
      
      for (const [key, val] of formData.entries()) {
        const container = document.getElementById('group-' + key);
        if (container && container.style.display === 'none') continue;
        
        const inputs = document.getElementsByName(key);
        if (inputs.length > 0 && inputs[0].type === 'checkbox') {
          if (!payload[key]) payload[key] = [];
          payload[key].push(val);
        } else {
          payload[key] = val;
        }
      }

      try {
        const response = await fetch('${submitUrl}', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const resData = await response.json();
        if (resData.success) {
          if (resData.redirectUrl) {
            window.location.href = resData.redirectUrl;
          } else {
            document.getElementById('onetap-form').style.display = 'none';
            document.getElementById('success-message').style.display = 'block';
          }
        } else {
          alert('Błąd: ' + (resData.error || 'Nieznany błąd serwera.'));
          btn.disabled = false;
          btn.innerText = 'Wyślij ankietę';
        }
      } catch (err) {
        alert('Błąd połączenia z serwerem.');
        btn.disabled = false;
        btn.innerText = 'Wyślij ankietę';
      }
    }
  </script>
</body>
</html>`;
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = await getSurvey(id);
  
  if (!survey) {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  
  let envUrl = process.env.NEXT_PUBLIC_APP_URL;
  let baseUrl = '';

  if (envUrl) {
    envUrl = envUrl.trim().replace(/\/+$/, '');
    if (envUrl.startsWith('http://')) {
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        baseUrl = envUrl;
      } else {
        baseUrl = envUrl.replace('http://', 'https://');
      }
    } else if (envUrl.startsWith('https://')) {
      baseUrl = envUrl;
    } else {
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        baseUrl = `http://${envUrl}`;
      } else {
        baseUrl = `https://${envUrl}`;
      }
    }
  } else {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      baseUrl = `http://${host}`;
    } else {
      baseUrl = `https://${host}`;
    }
  }

  const surveyUrl = `${baseUrl}/s/${survey.id}`;
  
  const schema = JSON.parse(survey.schema_json) as SurveySchema;
  
  const iframeCode = `<iframe src="${surveyUrl}" width="100%" height="600px" frameborder="0" style="border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></iframe>`;
  
  const embedCode = generateFullHTML(survey, schema, baseUrl);

  return (
    <div className="container">
      <ShareClient 
        surveyId={survey.id}
        surveyUrl={surveyUrl}
        iframeCode={iframeCode}
        embedCode={embedCode}
      />
    </div>
  );
}
