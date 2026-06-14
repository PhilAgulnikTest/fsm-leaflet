/* One-off: refresh server/data/translations/{lang}.json to the June 2026
 * converged copy WITHOUT calling the AI (no API key was available locally).
 *
 *   npx tsx server/src/db/apply-converged-translations.ts
 *
 * Only the 8 fields that actually changed are re-translated here (held in
 * CHANGED below); every unchanged field (cta titles, intro, labels,
 * attribution, the entitledto promo line) is reused verbatim from the existing
 * file, which already held a correct translation of that same English. The four
 * template sections are rebuilt from the converged "nawra" section:
 *   - nawra / cab  : generic calculator line + NAWRA attribution
 *   - housing      : generic calculator line + entitledto (LA) attribution
 *   - entitledto-la: entitledto promo calculator line + entitledto attribution
 *
 * ⚠️ These are machine-authored DRAFT translations of benefits information.
 * They MUST be checked by a native speaker / welfare-rights reviewer before
 * being relied on publicly. UK benefit names (Universal Credit, Pupil Premium,
 * Child Benefit, National Insurance, High Income Child Benefit Charge) and the
 * England school-year labels (Reception, Year 1, Year 2) are kept in English,
 * matching the existing translation convention. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const FIELDS = [
  'hero_title',
  'hero_subtitle',
  'box1_body_html',
  'box2_body_html',
  'box3_kicker',
  'box3_body_html',
  'how_to_intro',
  'how_to_steps_html',
] as const;
type Field = (typeof FIELDS)[number];

// Changed/new fields only, per language. Unchanged fields come from the
// existing file. HTML tags, the gov.uk URL and £80,000 are preserved.
const CHANGED: Record<string, Record<Field, string>> = {
  pl: {
    hero_title: 'Więcej dzieci będzie uprawnionych do bezpłatnych posiłków szkolnych',
    hero_subtitle: 'Ważna informacja dla rodziców i opiekunów — od września 2026 r.',
    box1_body_html:
      '<p>Od <strong>roku szkolnego 2026/27</strong> uprawnienie będzie sprawdzane co roku. W niektórych rejonach władze lokalne automatycznie zapiszą Twoje dziecko — sprawdź na stronie szkoły lub samorządu — w przeciwnym razie w razie potrzeby złóż wniosek ponownie, aby Twoje dziecko nadal otrzymywało bezpłatne posiłki <strong>i aby szkoła zachowała finansowanie Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>Twoje dziecko jest teraz uprawnione do bezpłatnych posiłków szkolnych. <strong>Złóż wniosek od 1 czerwca</strong> na początek semestru wrześniowego.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Wszystkie dzieci w klasach Reception, Year 1 i Year 2 otrzymują bezpłatne posiłki szkolne automatycznie, niezależnie od dochodu rodziny. Jeśli pobierasz Universal Credit, <strong>i tak poinformuj sekretariat szkoły i zarejestruj się</strong>. Dzięki temu szkoła otrzyma także dodatkowe środki o nazwie <strong>Pupil Premium</strong>, które służą wspieraniu wyników edukacyjnych wszystkich uczniów.</p>',
    how_to_intro: 'Około godziny Twojego czasu — i dwie rzeczy, które warto zrobić:',
    how_to_steps_html:
      '<li><strong>Złóż wniosek o bezpłatne posiłki szkolne</strong> w sekretariacie szkoły, na stronie internetowej szkoły lub w samorządzie lokalnym. Będziesz potrzebować: numeru National Insurance, swojego adresu i kodu pocztowego, imienia i nazwiska oraz daty urodzenia dziecka, a także nazwy pobieranego świadczenia (Universal Credit lub innego kwalifikującego świadczenia).</li>' +
      '<li><strong>Sprawdź, czy złożyłeś wniosek o <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Jeśli Ci przysługuje, może to oznaczać dodatkowy dochód. Warto też złożyć wniosek, ponieważ chroni on składki National Insurance rodzica pozostającego w domu — nawet jeśli jedno z rodziców zarabia ponad £80,000 i całość świadczenia jest odbierana przez High Income Child Benefit Charge, zarejestruj się mimo to i zaznacz pole rezygnacji z wypłaty.</li>',
  },
  ro: {
    hero_title: 'Mai mulți copii vor avea dreptul la mese școlare gratuite',
    hero_subtitle: 'Informații importante pentru părinți și îngrijitori — din septembrie 2026',
    box1_body_html:
      '<p>Începând cu <strong>anul școlar 2026/27</strong>, eligibilitatea va fi verificată în fiecare an. În unele zone, autoritatea locală vă va înscrie automat copilul — verificați pe site-ul școlii sau al consiliului local — în caz contrar, asigurați-vă că depuneți din nou cererea dacă este necesar, astfel încât copilul să își păstreze mesele gratuite <strong>și școala să își păstreze finanțarea Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>Copilul dumneavoastră are acum dreptul la mese școlare gratuite. <strong>Depuneți cererea de la 1 iunie</strong> pentru începutul trimestrului din septembrie.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Toți copiii din Reception, Year 1 și Year 2 primesc mese școlare gratuite în mod automat, indiferent de venitul familiei. Dacă primiți Universal Credit, <strong>anunțați totuși secretariatul școlii și înregistrați-vă</strong>. Astfel școala va primi și fonduri suplimentare numite <strong>Pupil Premium</strong>, folosite pentru a sprijini rezultatele educaționale ale tuturor.</p>',
    how_to_intro: 'Aproximativ o oră din timpul dumneavoastră — și două lucruri care merită făcute:',
    how_to_steps_html:
      '<li><strong>Solicitați mese școlare gratuite</strong> prin secretariatul școlii, site-ul școlii sau consiliul local. Veți avea nevoie de: numărul dumneavoastră National Insurance, adresa și codul poștal, numele complet și data nașterii copilului și denumirea beneficiului pe care îl primiți (Universal Credit sau alt beneficiu eligibil).</li>' +
      '<li><strong>Verificați dacă ați depus o cerere pentru <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Dacă aveți dreptul, ar putea însemna un venit suplimentar. Și merită solicitat, deoarece protejează contribuțiile National Insurance ale părintelui care stă acasă — chiar dacă unul dintre părinți câștigă peste £80,000 iar plata este recuperată integral prin High Income Child Benefit Charge, înregistrați-vă oricum și bifați căsuța pentru a renunța la plată.</li>',
  },
  pa: {
    hero_title: 'ਹੋਰ ਬੱਚੇ ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਦੇ ਹੱਕਦਾਰ ਹੋਣਗੇ',
    hero_subtitle: 'ਮਾਪਿਆਂ ਅਤੇ ਦੇਖਭਾਲ ਕਰਨ ਵਾਲਿਆਂ ਲਈ ਜ਼ਰੂਰੀ ਖ਼ਬਰ — ਸਤੰਬਰ 2026 ਤੋਂ',
    box1_body_html:
      '<p><strong>2026/27 ਸਕੂਲੀ ਸਾਲ</strong> ਤੋਂ, ਯੋਗਤਾ ਹਰ ਸਾਲ ਜਾਂਚੀ ਜਾਵੇਗੀ। ਕੁਝ ਖੇਤਰਾਂ ਵਿੱਚ ਤੁਹਾਡੀ ਲੋਕਲ ਅਥਾਰਟੀ ਤੁਹਾਡੇ ਬੱਚੇ ਨੂੰ ਆਪਣੇ-ਆਪ ਦਾਖ਼ਲ ਕਰ ਦੇਵੇਗੀ — ਸਕੂਲ ਜਾਂ ਕੌਂਸਲ ਦੀ ਵੈੱਬਸਾਈਟ ਉੱਤੇ ਜਾਂਚ ਕਰੋ — ਨਹੀਂ ਤਾਂ ਲੋੜ ਪੈਣ ’ਤੇ ਦੁਬਾਰਾ ਅਰਜ਼ੀ ਜ਼ਰੂਰ ਦਿਓ, ਤਾਂ ਜੋ ਤੁਹਾਡੇ ਬੱਚੇ ਨੂੰ ਮੁਫ਼ਤ ਭੋਜਨ ਮਿਲਦਾ ਰਹੇ <strong>ਅਤੇ ਸਕੂਲ ਨੂੰ ਉਸ ਦੀ Pupil Premium ਫੰਡਿੰਗ ਮਿਲਦੀ ਰਹੇ</strong>।</p>',
    box2_body_html:
      '<p>ਤੁਹਾਡਾ ਬੱਚਾ ਹੁਣ ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਦਾ ਹੱਕਦਾਰ ਹੈ। ਸਤੰਬਰ ਟਰਮ ਦੀ ਸ਼ੁਰੂਆਤ ਲਈ <strong>1 ਜੂਨ ਤੋਂ ਅਰਜ਼ੀ ਦਿਓ</strong>।</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Reception, Year 1 ਅਤੇ Year 2 ਦੇ ਸਾਰੇ ਬੱਚੇ, ਪਰਿਵਾਰ ਦੀ ਆਮਦਨ ਜੋ ਵੀ ਹੋਵੇ, ਆਪਣੇ-ਆਪ ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਪ੍ਰਾਪਤ ਕਰਦੇ ਹਨ। ਜੇ ਤੁਸੀਂ Universal Credit ਲੈਂਦੇ ਹੋ, ਤਾਂ <strong>ਫਿਰ ਵੀ ਸਕੂਲ ਦੇ ਦਫ਼ਤਰ ਨੂੰ ਦੱਸੋ ਅਤੇ ਰਜਿਸਟਰ ਕਰੋ</strong>। ਇਸ ਨਾਲ ਸਕੂਲ ਨੂੰ <strong>Pupil Premium</strong> ਨਾਂ ਦੀ ਵਾਧੂ ਫੰਡਿੰਗ ਵੀ ਮਿਲੇਗੀ, ਜੋ ਸਾਰਿਆਂ ਦੇ ਵਿੱਦਿਅਕ ਨਤੀਜਿਆਂ ਨੂੰ ਸਹਾਰਾ ਦੇਣ ਲਈ ਵਰਤੀ ਜਾਂਦੀ ਹੈ।</p>',
    how_to_intro: 'ਤੁਹਾਡੇ ਸਮੇਂ ਦਾ ਲਗਭਗ ਇੱਕ ਘੰਟਾ — ਅਤੇ ਦੋ ਕੰਮ ਜੋ ਕਰਨ ਯੋਗ ਹਨ:',
    how_to_steps_html:
      '<li>ਆਪਣੇ ਸਕੂਲ ਦੇ ਦਫ਼ਤਰ, ਸਕੂਲ ਦੀ ਵੈੱਬਸਾਈਟ ਜਾਂ ਆਪਣੀ ਲੋਕਲ ਕੌਂਸਲ ਰਾਹੀਂ <strong>ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਲਈ ਅਰਜ਼ੀ ਦਿਓ</strong>। ਤੁਹਾਨੂੰ ਇਹ ਚਾਹੀਦਾ ਹੋਵੇਗਾ: ਤੁਹਾਡਾ National Insurance ਨੰਬਰ, ਤੁਹਾਡਾ ਪਤਾ ਅਤੇ ਪੋਸਟਕੋਡ, ਤੁਹਾਡੇ ਬੱਚੇ ਦਾ ਪੂਰਾ ਨਾਂ ਅਤੇ ਜਨਮ ਮਿਤੀ, ਅਤੇ ਉਸ ਲਾਭ ਦਾ ਨਾਂ ਜੋ ਤੁਸੀਂ ਲੈਂਦੇ ਹੋ (Universal Credit ਜਾਂ ਕੋਈ ਹੋਰ ਯੋਗ ਲਾਭ)।</li>' +
      '<li><strong>ਜਾਂਚ ਕਰੋ ਕਿ ਤੁਸੀਂ <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a> ਲਈ ਅਰਜ਼ੀ ਦਿੱਤੀ ਹੈ।</strong> ਜੇ ਤੁਸੀਂ ਹੱਕਦਾਰ ਹੋ ਤਾਂ ਇਸ ਦਾ ਮਤਲਬ ਕੁਝ ਵਾਧੂ ਆਮਦਨ ਹੋ ਸਕਦੀ ਹੈ। ਅਤੇ ਅਰਜ਼ੀ ਦੇਣਾ ਇਸ ਲਈ ਵੀ ਚੰਗਾ ਹੈ ਕਿਉਂਕਿ ਇਹ ਘਰ ਰਹਿਣ ਵਾਲੇ ਮਾਪੇ ਦੇ National Insurance ਰਿਕਾਰਡ ਦੀ ਰਾਖੀ ਕਰਦਾ ਹੈ — ਭਾਵੇਂ ਇੱਕ ਮਾਪੇ ਦੀ ਕਮਾਈ £80,000 ਤੋਂ ਵੱਧ ਹੋਵੇ ਅਤੇ ਪੂਰੀ ਰਕਮ High Income Child Benefit Charge ਰਾਹੀਂ ਵਾਪਸ ਲੈ ਲਈ ਜਾਵੇ, ਤਾਂ ਵੀ ਰਜਿਸਟਰ ਕਰੋ ਅਤੇ ਭੁਗਤਾਨ ਤੋਂ ਬਾਹਰ ਰਹਿਣ ਲਈ ਬਾਕਸ ’ਤੇ ਨਿਸ਼ਾਨ ਲਗਾਓ।</li>',
  },
  ur: {
    hero_title: 'مزید بچے مفت اسکول کھانوں کے حقدار ہوں گے',
    hero_subtitle: 'والدین اور دیکھ بھال کرنے والوں کے لیے اہم خبر — ستمبر 2026 سے',
    box1_body_html:
      '<p><strong>2026/27 تعلیمی سال</strong> سے اہلیت کی جانچ ہر سال کی جائے گی۔ کچھ علاقوں میں آپ کی لوکل اتھارٹی آپ کے بچے کا خود بخود اندراج کر دے گی — اسکول یا کونسل کی ویب سائٹ پر دیکھیں — ورنہ ضرورت پڑنے پر دوبارہ درخواست ضرور دیں، تاکہ آپ کے بچے کو مفت کھانے ملتے رہیں <strong>اور اسکول کو اس کی Pupil Premium فنڈنگ ملتی رہے</strong>۔</p>',
    box2_body_html:
      '<p>آپ کا بچہ اب مفت اسکول کھانوں کا حقدار ہے۔ ستمبر ٹرم کے آغاز کے لیے <strong>1 جون سے درخواست دیں</strong>۔</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Reception، Year 1 اور Year 2 کے تمام بچے، خاندان کی آمدنی چاہے کچھ بھی ہو، خود بخود مفت اسکول کھانے حاصل کرتے ہیں۔ اگر آپ Universal Credit حاصل کرتے ہیں تو <strong>پھر بھی اسکول کے دفتر کو بتائیں اور رجسٹر کریں</strong>۔ اس سے اسکول کو <strong>Pupil Premium</strong> نامی اضافی فنڈنگ بھی ملے گی، جو سب کے تعلیمی نتائج کی مدد کے لیے استعمال ہوتی ہے۔</p>',
    how_to_intro: 'آپ کے وقت کا تقریباً ایک گھنٹہ — اور دو کام جو کرنے کے قابل ہیں:',
    how_to_steps_html:
      '<li>اپنے اسکول کے دفتر، اسکول کی ویب سائٹ، یا اپنی لوکل کونسل کے ذریعے <strong>مفت اسکول کھانوں کے لیے درخواست دیں</strong>۔ آپ کو ان کی ضرورت ہوگی: آپ کا National Insurance نمبر، آپ کا پتہ اور پوسٹ کوڈ، آپ کے بچے کا پورا نام اور تاریخِ پیدائش، اور اس فائدے کا نام جو آپ حاصل کرتے ہیں (Universal Credit یا کوئی اور اہل فائدہ)۔</li>' +
      '<li><strong>یہ یقینی بنائیں کہ آپ نے <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a> کے لیے درخواست دی ہے۔</strong> اگر آپ حقدار ہیں تو اس کا مطلب کچھ اضافی آمدنی ہو سکتی ہے۔ اور درخواست دینا اس لیے بھی بہتر ہے کیونکہ یہ گھر میں رہنے والے والد یا والدہ کے National Insurance ریکارڈ کی حفاظت کرتا ہے — چاہے ایک والدین £80,000 سے زیادہ کمائیں اور ساری رقم High Income Child Benefit Charge کے ذریعے واپس لے لی جائے، پھر بھی رجسٹر کریں اور ادائیگی سے دستبردار ہونے کے لیے باکس پر نشان لگائیں۔</li>',
  },
  pt: {
    hero_title: 'Mais crianças terão direito a refeições escolares gratuitas',
    hero_subtitle: 'Informação importante para pais e cuidadores — a partir de setembro de 2026',
    box1_body_html:
      '<p>A partir do <strong>ano letivo de 2026/27</strong>, a elegibilidade será verificada todos os anos. Em algumas zonas, a sua autarquia inscreverá automaticamente o seu filho — verifique no site da escola ou da câmara — caso contrário, certifique-se de que volta a candidatar-se se for necessário, para que o seu filho continue a receber refeições gratuitas <strong>e a escola mantenha o seu financiamento Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>O seu filho tem agora direito a refeições escolares gratuitas. <strong>Candidate-se a partir de 1 de junho</strong> para o início do período de setembro.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Todas as crianças do Reception, Year 1 e Year 2 recebem refeições escolares gratuitas automaticamente, qualquer que seja o rendimento da família. Se recebe Universal Credit, <strong>informe mesmo assim a secretaria da escola e inscreva-se</strong>. Isto trará também à escola um financiamento adicional chamado <strong>Pupil Premium</strong>, usado para apoiar os resultados educativos de todos.</p>',
    how_to_intro: 'Cerca de uma hora do seu tempo — e duas coisas que vale a pena fazer:',
    how_to_steps_html:
      '<li><strong>Candidate-se a refeições escolares gratuitas</strong> através da secretaria da escola, do site da escola ou da sua câmara municipal. Vai precisar de: o seu número de National Insurance, a sua morada e código postal, o nome completo e a data de nascimento do seu filho, e o nome do benefício que recebe (Universal Credit ou outro benefício elegível).</li>' +
      '<li><strong>Verifique se apresentou um pedido de <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Se tiver direito, pode significar algum rendimento adicional. E vale a pena pedir, pois protege o registo de National Insurance do progenitor que fica em casa — mesmo que um dos pais ganhe mais de £80,000 e o pagamento seja totalmente recuperado pelo High Income Child Benefit Charge, inscreva-se na mesma e assinale a caixa para optar por não receber o pagamento.</li>',
  },
  es: {
    hero_title: 'Más niños tendrán derecho a comidas escolares gratuitas',
    hero_subtitle: 'Información importante para padres y cuidadores — desde septiembre de 2026',
    box1_body_html:
      '<p>A partir del <strong>curso escolar 2026/27</strong>, la elegibilidad se comprobará cada año. En algunas zonas, su ayuntamiento inscribirá automáticamente a su hijo — compruébelo en el sitio web de la escuela o del ayuntamiento — y, de lo contrario, asegúrese de volver a solicitarlo si es necesario, para que su hijo siga recibiendo comidas gratuitas <strong>y la escuela conserve su financiación Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>Su hijo ahora tiene derecho a comidas escolares gratuitas. <strong>Solicítelo a partir del 1 de junio</strong> para el inicio del trimestre de septiembre.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Todos los niños de Reception, Year 1 y Year 2 reciben comidas escolares gratuitas automáticamente, sea cual sea el ingreso familiar. Si recibe Universal Credit, <strong>informe igualmente a la secretaría de la escuela y regístrese</strong>. Esto también aportará a la escuela una financiación adicional llamada <strong>Pupil Premium</strong>, que se utiliza para apoyar los resultados educativos de todos.</p>',
    how_to_intro: 'Alrededor de una hora de su tiempo — y dos cosas que vale la pena hacer:',
    how_to_steps_html:
      '<li><strong>Solicite comidas escolares gratuitas</strong> a través de la secretaría de la escuela, el sitio web de la escuela o su ayuntamiento. Necesitará: su número de National Insurance, su dirección y código postal, el nombre completo y la fecha de nacimiento de su hijo, y el nombre de la prestación que recibe (Universal Credit u otra prestación que dé derecho).</li>' +
      '<li><strong>Compruebe que ha presentado una solicitud de <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Si tiene derecho, podría suponer algún ingreso adicional. Y conviene solicitarlo porque protege el registro de National Insurance del progenitor que se queda en casa — aunque uno de los padres gane más de £80,000 y el pago se recupere por completo mediante el High Income Child Benefit Charge, regístrese de todos modos y marque la casilla para renunciar al pago.</li>',
  },
  bn: {
    hero_title: 'আরও বেশি শিশু বিনামূল্যে স্কুল মিলের অধিকারী হবে',
    hero_subtitle: 'অভিভাবক ও পরিচর্যাকারীদের জন্য গুরুত্বপূর্ণ খবর — সেপ্টেম্বর ২০২৬ থেকে',
    box1_body_html:
      '<p><strong>২০২৬/২৭ স্কুল বছর</strong> থেকে যোগ্যতা প্রতি বছর যাচাই করা হবে। কিছু এলাকায় আপনার লোকাল অথরিটি স্বয়ংক্রিয়ভাবে আপনার সন্তানকে নথিভুক্ত করবে — স্কুল বা কাউন্সিলের ওয়েবসাইটে দেখে নিন — অন্যথায় প্রয়োজন হলে আবার আবেদন করতে ভুলবেন না, যাতে আপনার সন্তান বিনামূল্যে মিল পেতে থাকে <strong>এবং স্কুল তার Pupil Premium তহবিল ধরে রাখে</strong>।</p>',
    box2_body_html:
      '<p>আপনার সন্তান এখন বিনামূল্যে স্কুল মিলের অধিকারী। সেপ্টেম্বর টার্ম শুরুর জন্য <strong>১ জুন থেকে আবেদন করুন</strong>।</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Reception, Year 1 ও Year 2-এর সব শিশু, পরিবারের আয় যাই হোক না কেন, স্বয়ংক্রিয়ভাবে বিনামূল্যে স্কুল মিল পায়। আপনি যদি Universal Credit পান, <strong>তবুও স্কুল অফিসে জানান এবং নিবন্ধন করুন</strong>। এতে স্কুলটি <strong>Pupil Premium</strong> নামে অতিরিক্ত তহবিলও পাবে, যা সবার শিক্ষাগত ফলাফলকে সহায়তা করতে ব্যবহার করা হয়।</p>',
    how_to_intro: 'আপনার সময়ের প্রায় এক ঘণ্টা — এবং করার মতো দুটি কাজ:',
    how_to_steps_html:
      '<li>আপনার স্কুল অফিস, স্কুলের ওয়েবসাইট, বা আপনার লোকাল কাউন্সিলের মাধ্যমে <strong>বিনামূল্যে স্কুল মিলের জন্য আবেদন করুন</strong>। আপনার লাগবে: আপনার National Insurance নম্বর, আপনার ঠিকানা ও পোস্টকোড, আপনার সন্তানের পুরো নাম ও জন্মতারিখ, এবং আপনি যে সুবিধা পান তার নাম (Universal Credit বা অন্য কোনো যোগ্য সুবিধা)।</li>' +
      '<li><strong>নিশ্চিত করুন যে আপনি <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>-এর জন্য আবেদন করেছেন।</strong> আপনি অধিকারী হলে এর অর্থ কিছু বাড়তি আয় হতে পারে। আর আবেদন করা ভালো কারণ এটি ঘরে থাকা অভিভাবকের National Insurance রেকর্ড রক্ষা করে — এমনকি যদি একজন অভিভাবক £80,000-এর বেশি আয় করেন এবং পুরো অর্থ High Income Child Benefit Charge-এর মাধ্যমে ফেরত নেওয়া হয়, তবুও নিবন্ধন করুন এবং অর্থপ্রদান থেকে বিরত থাকতে বক্সে টিক দিন।</li>',
  },
  gu: {
    hero_title: 'વધુ બાળકો મફત શાળા ભોજનના હકદાર બનશે',
    hero_subtitle: 'માતા-પિતા અને સંભાળ રાખનારાઓ માટે મહત્વના સમાચાર — સપ્ટેમ્બર 2026 થી',
    box1_body_html:
      '<p><strong>2026/27 શાળા વર્ષ</strong> થી, પાત્રતા દર વર્ષે તપાસવામાં આવશે. કેટલાક વિસ્તારોમાં તમારી લોકલ ઓથોરિટી તમારા બાળકને આપમેળે નોંધણી કરશે — શાળા અથવા કાઉન્સિલની વેબસાઇટ પર તપાસો — નહીંતર જરૂર પડ્યે ફરીથી અરજી કરવાનું ભૂલશો નહીં, જેથી તમારા બાળકને મફત ભોજન મળતું રહે <strong>અને શાળાને તેનું Pupil Premium ભંડોળ મળતું રહે</strong>.</p>',
    box2_body_html:
      '<p>તમારું બાળક હવે મફત શાળા ભોજનનું હકદાર છે. સપ્ટેમ્બર ટર્મની શરૂઆત માટે <strong>1 જૂનથી અરજી કરો</strong>.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Reception, Year 1 અને Year 2 ના બધાં બાળકો, કુટુંબની આવક ગમે તે હોય, આપમેળે મફત શાળા ભોજન મેળવે છે. જો તમે Universal Credit મેળવતા હો, તો <strong>તેમ છતાં શાળાની ઓફિસને જણાવો અને નોંધણી કરો</strong>. આથી શાળાને <strong>Pupil Premium</strong> નામનું વધારાનું ભંડોળ પણ મળશે, જે બધાંના શૈક્ષણિક પરિણામોને ટેકો આપવા વપરાય છે.</p>',
    how_to_intro: 'તમારા સમયનો આશરે એક કલાક — અને કરવા જેવી બે બાબતો:',
    how_to_steps_html:
      '<li>તમારી શાળાની ઓફિસ, શાળાની વેબસાઇટ, અથવા તમારી લોકલ કાઉન્સિલ મારફતે <strong>મફત શાળા ભોજન માટે અરજી કરો</strong>. તમને જરૂર પડશે: તમારો National Insurance નંબર, તમારું સરનામું અને પોસ્ટકોડ, તમારા બાળકનું પૂરું નામ અને જન્મતારીખ, અને તમે મેળવો છો તે લાભનું નામ (Universal Credit અથવા અન્ય પાત્ર લાભ).</li>' +
      '<li><strong>ખાતરી કરો કે તમે <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a> માટે અરજી કરી છે.</strong> જો તમે હકદાર હો તો તેનો અર્થ થોડી વધારાની આવક થઈ શકે છે. અને અરજી કરવી એ માટે પણ યોગ્ય છે કે તે ઘરે રહેતા માતા-પિતાના National Insurance રેકોર્ડનું રક્ષણ કરે છે — ભલે એક માતા-પિતા £80,000 થી વધુ કમાતા હોય અને આખી રકમ High Income Child Benefit Charge દ્વારા પાછી લેવાઈ જાય, તેમ છતાં નોંધણી કરો અને ચુકવણીમાંથી બહાર રહેવા બોક્સ પર ટિક કરો.</li>',
  },
  it: {
    hero_title: 'Più bambini avranno diritto ai pasti scolastici gratuiti',
    hero_subtitle: 'Informazioni importanti per genitori e tutori — da settembre 2026',
    box1_body_html:
      '<p>Dall\'<strong>anno scolastico 2026/27</strong>, l\'idoneità sarà verificata ogni anno. In alcune zone l\'autorità locale iscriverà automaticamente vostro figlio — verificate sul sito della scuola o del comune — altrimenti assicuratevi di ripresentare la domanda se necessario, in modo che vostro figlio continui a ricevere i pasti gratuiti <strong>e la scuola mantenga il suo finanziamento Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>Vostro figlio ha ora diritto ai pasti scolastici gratuiti. <strong>Fate domanda dal 1° giugno</strong> per l\'inizio del trimestre di settembre.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Tutti i bambini di Reception, Year 1 e Year 2 ricevono automaticamente i pasti scolastici gratuiti, qualunque sia il reddito familiare. Se ricevete Universal Credit, <strong>informate comunque la segreteria della scuola e iscrivetevi</strong>. In questo modo la scuola riceverà anche un finanziamento aggiuntivo chiamato <strong>Pupil Premium</strong>, usato per sostenere i risultati educativi di tutti.</p>',
    how_to_intro: 'Circa un\'ora del vostro tempo — e due cose che vale la pena fare:',
    how_to_steps_html:
      '<li><strong>Fate domanda per i pasti scolastici gratuiti</strong> tramite la segreteria della scuola, il sito della scuola o il vostro comune. Vi serviranno: il vostro numero National Insurance, il vostro indirizzo e codice postale, il nome completo e la data di nascita di vostro figlio, e il nome del beneficio che ricevete (Universal Credit o un altro beneficio che dà diritto).</li>' +
      '<li><strong>Verificate di aver presentato una domanda per il <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Se ne avete diritto, potrebbe significare un reddito aggiuntivo. E conviene farne domanda perché protegge la posizione National Insurance del genitore che resta a casa — anche se un genitore guadagna più di £80,000 e il pagamento viene interamente recuperato tramite l\'High Income Child Benefit Charge, iscrivetevi comunque e spuntate la casella per rinunciare al pagamento.</li>',
  },
  cy: {
    hero_title: 'Bydd mwy o blant yn gymwys i gael prydau ysgol am ddim',
    hero_subtitle: 'Newyddion pwysig i rieni a gofalwyr — o fis Medi 2026',
    box1_body_html:
      '<p>O <strong>flwyddyn ysgol 2026/27</strong>, bydd cymhwysedd yn cael ei wirio bob blwyddyn. Mewn rhai ardaloedd bydd eich awdurdod lleol yn cofrestru eich plentyn yn awtomatig — gwiriwch ar wefan yr ysgol neu\'r cyngor — fel arall, gwnewch yn siŵr eich bod yn gwneud cais eto os oes angen, fel bod eich plentyn yn cadw ei brydau am ddim <strong>a bod yr ysgol yn cadw ei chyllid Pupil Premium</strong>.</p>',
    box2_body_html:
      '<p>Mae eich plentyn bellach yn gymwys i gael prydau ysgol am ddim. <strong>Gwnewch gais o 1 Mehefin</strong> ar gyfer dechrau tymor mis Medi.</p>',
    box3_kicker: 'RECEPTION · YEAR 1 · YEAR 2',
    box3_body_html:
      '<p>Mae pob plentyn yn Reception, Year 1 a Year 2 yn cael prydau ysgol am ddim yn awtomatig, beth bynnag yw incwm y teulu. Os ydych yn cael Universal Credit, <strong>dywedwch wrth swyddfa\'r ysgol a chofrestrwch beth bynnag</strong>. Bydd hyn hefyd yn dod â chyllid ychwanegol o\'r enw <strong>Pupil Premium</strong> i\'r ysgol, a ddefnyddir i gefnogi canlyniadau addysgol pawb.</p>',
    how_to_intro: 'Tua awr o\'ch amser — a dau beth gwerth eu gwneud:',
    how_to_steps_html:
      '<li><strong>Gwnewch gais am brydau ysgol am ddim</strong> drwy swyddfa\'r ysgol, gwefan yr ysgol, neu eich cyngor lleol. Bydd angen y canlynol arnoch: eich rhif National Insurance, eich cyfeiriad a chod post, enw llawn a dyddiad geni eich plentyn, ac enw\'r budd-dal rydych yn ei gael (Universal Credit neu fudd-dal cymwys arall).</li>' +
      '<li><strong>Gwiriwch eich bod wedi gwneud cais am <a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>.</strong> Os ydych yn gymwys, gallai olygu rhywfaint o incwm ychwanegol. Ac mae\'n werth gwneud cais gan ei fod yn diogelu cofnod National Insurance y rhiant sydd gartref — hyd yn oed os yw un rhiant yn ennill dros £80,000 a bod y taliad yn cael ei adennill yn llawn gan yr High Income Child Benefit Charge, cofrestrwch beth bynnag a thiciwch y blwch i optio allan o daliad.</li>',
  },
};

function main() {
  const dir = path.resolve(config.paths.serverRoot, 'data', 'translations');
  let count = 0;
  for (const [lang, changed] of Object.entries(CHANGED)) {
    const file = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(file)) { console.warn(`  skip ${lang}: no existing file`); continue; }
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
    const oldNawra = (doc.nawra ?? {}) as Record<string, string>;
    const oldEla = (doc['entitledto-la'] ?? {}) as Record<string, string>;

    // Converged section: reuse the existing (correct) nawra translation for the
    // unchanged fields, overwrite the changed ones, drop the now-empty date.
    const converged: Record<string, string> = { ...oldNawra, ...changed };
    delete converged.hero_date;

    doc.nawra = converged;
    doc.cab = { ...converged };
    doc['housing-association'] = { ...converged, attribution_html: oldEla.attribution_html ?? converged.attribution_html };
    doc['entitledto-la'] = {
      ...converged,
      cta_secondary_body_html: oldEla.cta_secondary_body_html ?? converged.cta_secondary_body_html,
      attribution_html: oldEla.attribution_html ?? converged.attribution_html,
    };

    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    count += 1;
    console.log(`  ${lang}.json updated (nawra, cab, housing-association, entitledto-la)`);
  }
  console.log(`Done: ${count} language files refreshed to converged copy.`);
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('apply-converged-translations.ts') || entry.endsWith('apply-converged-translations.js'))) {
  main();
}
