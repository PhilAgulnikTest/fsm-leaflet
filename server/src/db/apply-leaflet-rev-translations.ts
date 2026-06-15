/* One-off: update server/data/translations/{lang}.json for the leaflet
 * revision (the marked-up "FINAL AD" version), without calling the AI.
 *
 *   npx tsx server/src/db/apply-leaflet-rev-translations.ts
 *
 * Only the SIX fields that changed in this revision are overwritten; every
 * other field keeps its existing translation. The generic calculator line
 * (cta_secondary_body_html) is updated for nawra/cab/housing only — the
 * entitledto-la promo line is left untouched.
 *
 * Changes this round (English):
 *   - cta_primary_title:  "Register from 1 June" → "...1 June 2026"
 *   - box1_body_html:     "the 2026/27 school year" → "the next (2026/27) school year"
 *   - box3_body_html:     "...for all." → "...for all pupils."
 *   - how_to_intro:       shortened to "About an hour of your time."
 *   - cta_secondary_body_html (generic): dropped "still", added "and confidential"
 *   - label_how_to_claim: "HOW TO CLAIM" → "HOW TO CLAIM THESE BENEFITS"
 *
 * ⚠️ Machine-authored DRAFT translations of benefits information — need a
 * native-speaker / welfare-rights review before public reliance. UK benefit
 * names and England school-year labels kept in English. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

type Six = {
  cta_primary_title: string;
  box1_body_html: string;
  box3_body_html: string;
  how_to_intro: string;
  cta_secondary_body_html: string; // generic line (nawra/cab/housing)
  label_how_to_claim: string;
};

const REV: Record<string, Six> = {
  pl: {
    cta_primary_title: 'Zarejestruj się od 1 czerwca 2026',
    box1_body_html:
      '<p>Od <strong>następnego roku szkolnego (2026/27)</strong> uprawnienie będzie sprawdzane co roku. W niektórych rejonach władze lokalne automatycznie zapiszą Twoje dziecko — sprawdź na stronie szkoły lub samorządu — w przeciwnym razie w razie potrzeby złóż wniosek ponownie, aby Twoje dziecko nadal otrzymywało bezpłatne posiłki <strong>i aby szkoła zachowała finansowanie Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Wszystkie dzieci w klasach Reception, Year 1 i Year 2 otrzymują bezpłatne posiłki szkolne automatycznie, niezależnie od dochodu rodziny. Jeśli pobierasz Universal Credit, <strong>i tak poinformuj sekretariat szkoły i zarejestruj się</strong>. Dzięki temu szkoła otrzyma także dodatkowe środki o nazwie <strong>Pupil Premium</strong>, które służą wspieraniu wyników edukacyjnych wszystkich uczniów.</p>',
    how_to_intro: 'Około godziny Twojego czasu.',
    cta_secondary_body_html:
      'Być może przysługuje Ci pomoc. Bezpłatny i poufny kalkulator świadczeń powie Ci, czy możesz kwalifikować się do Universal Credit i bezpłatnych posiłków szkolnych.',
    label_how_to_claim: 'JAK UBIEGAĆ SIĘ O TE ŚWIADCZENIA',
  },
  ro: {
    cta_primary_title: 'Înscrieți-vă de la 1 iunie 2026',
    box1_body_html:
      '<p>Începând cu <strong>următorul an școlar (2026/27)</strong>, eligibilitatea va fi verificată în fiecare an. În unele zone, autoritatea locală vă va înscrie automat copilul — verificați pe site-ul școlii sau al consiliului local — în caz contrar, asigurați-vă că depuneți din nou cererea dacă este necesar, astfel încât copilul să își păstreze mesele gratuite <strong>și școala să își păstreze finanțarea Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Toți copiii din Reception, Year 1 și Year 2 primesc mese școlare gratuite în mod automat, indiferent de venitul familiei. Dacă primiți Universal Credit, <strong>anunțați totuși secretariatul școlii și înregistrați-vă</strong>. Astfel școala va primi și fonduri suplimentare numite <strong>Pupil Premium</strong>, folosite pentru a sprijini rezultatele educaționale ale tuturor elevilor.</p>',
    how_to_intro: 'Aproximativ o oră din timpul dumneavoastră.',
    cta_secondary_body_html:
      'S-ar putea să aveți dreptul. Un calculator de beneficii gratuit și confidențial vă va spune dacă ați putea avea dreptul la Universal Credit și la mese școlare gratuite.',
    label_how_to_claim: 'CUM SĂ SOLICITAȚI ACESTE BENEFICII',
  },
  pa: {
    cta_primary_title: '1 ਜੂਨ 2026 ਤੋਂ ਰਜਿਸਟਰ ਕਰੋ',
    box1_body_html:
      '<p><strong>ਅਗਲੇ (2026/27) ਸਕੂਲੀ ਸਾਲ</strong> ਤੋਂ, ਯੋਗਤਾ ਹਰ ਸਾਲ ਜਾਂਚੀ ਜਾਵੇਗੀ। ਕੁਝ ਖੇਤਰਾਂ ਵਿੱਚ ਤੁਹਾਡੀ ਲੋਕਲ ਅਥਾਰਟੀ ਤੁਹਾਡੇ ਬੱਚੇ ਨੂੰ ਆਪਣੇ-ਆਪ ਦਾਖ਼ਲ ਕਰ ਦੇਵੇਗੀ — ਸਕੂਲ ਜਾਂ ਕੌਂਸਲ ਦੀ ਵੈੱਬਸਾਈਟ ਉੱਤੇ ਜਾਂਚ ਕਰੋ — ਨਹੀਂ ਤਾਂ ਲੋੜ ਪੈਣ ’ਤੇ ਦੁਬਾਰਾ ਅਰਜ਼ੀ ਜ਼ਰੂਰ ਦਿਓ, ਤਾਂ ਜੋ ਤੁਹਾਡੇ ਬੱਚੇ ਨੂੰ ਮੁਫ਼ਤ ਭੋਜਨ ਮਿਲਦਾ ਰਹੇ <strong>ਅਤੇ ਸਕੂਲ ਨੂੰ ਉਸ ਦੀ Pupil Premium ਫੰਡਿੰਗ ਮਿਲਦੀ ਰਹੇ</strong>।</p>',
    box3_body_html:
      '<p>Reception, Year 1 ਅਤੇ Year 2 ਦੇ ਸਾਰੇ ਬੱਚੇ, ਪਰਿਵਾਰ ਦੀ ਆਮਦਨ ਜੋ ਵੀ ਹੋਵੇ, ਆਪਣੇ-ਆਪ ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਪ੍ਰਾਪਤ ਕਰਦੇ ਹਨ। ਜੇ ਤੁਸੀਂ Universal Credit ਲੈਂਦੇ ਹੋ, ਤਾਂ <strong>ਫਿਰ ਵੀ ਸਕੂਲ ਦੇ ਦਫ਼ਤਰ ਨੂੰ ਦੱਸੋ ਅਤੇ ਰਜਿਸਟਰ ਕਰੋ</strong>। ਇਸ ਨਾਲ ਸਕੂਲ ਨੂੰ <strong>Pupil Premium</strong> ਨਾਂ ਦੀ ਵਾਧੂ ਫੰਡਿੰਗ ਵੀ ਮਿਲੇਗੀ, ਜੋ ਸਾਰੇ ਵਿਦਿਆਰਥੀਆਂ ਦੇ ਵਿੱਦਿਅਕ ਨਤੀਜਿਆਂ ਨੂੰ ਸਹਾਰਾ ਦੇਣ ਲਈ ਵਰਤੀ ਜਾਂਦੀ ਹੈ।</p>',
    how_to_intro: 'ਤੁਹਾਡੇ ਸਮੇਂ ਦਾ ਲਗਭਗ ਇੱਕ ਘੰਟਾ।',
    cta_secondary_body_html:
      'ਹੋ ਸਕਦਾ ਹੈ ਤੁਸੀਂ ਹੱਕਦਾਰ ਹੋਵੋ। ਇੱਕ ਮੁਫ਼ਤ ਅਤੇ ਗੁਪਤ ਲਾਭ ਕੈਲਕੁਲੇਟਰ ਤੁਹਾਨੂੰ ਦੱਸੇਗਾ ਕਿ ਕੀ ਤੁਸੀਂ Universal Credit ਅਤੇ ਮੁਫ਼ਤ ਸਕੂਲ ਭੋਜਨ ਲਈ ਯੋਗ ਹੋ ਸਕਦੇ ਹੋ।',
    label_how_to_claim: 'ਇਹ ਲਾਭ ਕਿਵੇਂ ਪ੍ਰਾਪਤ ਕਰਨੇ ਹਨ',
  },
  ur: {
    cta_primary_title: '1 جون 2026 سے رجسٹر کریں',
    box1_body_html:
      '<p><strong>اگلے (2026/27) تعلیمی سال</strong> سے اہلیت کی جانچ ہر سال کی جائے گی۔ کچھ علاقوں میں آپ کی لوکل اتھارٹی آپ کے بچے کا خود بخود اندراج کر دے گی — اسکول یا کونسل کی ویب سائٹ پر دیکھیں — ورنہ ضرورت پڑنے پر دوبارہ درخواست ضرور دیں، تاکہ آپ کے بچے کو مفت کھانے ملتے رہیں <strong>اور اسکول کو اس کی Pupil Premium فنڈنگ ملتی رہے</strong>۔</p>',
    box3_body_html:
      '<p>Reception، Year 1 اور Year 2 کے تمام بچے، خاندان کی آمدنی چاہے کچھ بھی ہو، خود بخود مفت اسکول کھانے حاصل کرتے ہیں۔ اگر آپ Universal Credit حاصل کرتے ہیں تو <strong>پھر بھی اسکول کے دفتر کو بتائیں اور رجسٹر کریں</strong>۔ اس سے اسکول کو <strong>Pupil Premium</strong> نامی اضافی فنڈنگ بھی ملے گی، جو تمام طلباء کے تعلیمی نتائج کی مدد کے لیے استعمال ہوتی ہے۔</p>',
    how_to_intro: 'آپ کے وقت کا تقریباً ایک گھنٹہ۔',
    cta_secondary_body_html:
      'ہو سکتا ہے آپ حقدار ہوں۔ ایک مفت اور خفیہ بینیفٹ کیلکولیٹر آپ کو بتائے گا کہ آیا آپ Universal Credit اور مفت اسکول کھانوں کے اہل ہو سکتے ہیں۔',
    label_how_to_claim: 'یہ فوائد کیسے حاصل کریں',
  },
  pt: {
    cta_primary_title: 'Inscreva-se a partir de 1 de junho de 2026',
    box1_body_html:
      '<p>A partir do <strong>próximo ano letivo (2026/27)</strong>, a elegibilidade será verificada todos os anos. Em algumas zonas, a sua autarquia inscreverá automaticamente o seu filho — verifique no site da escola ou da câmara — caso contrário, certifique-se de que volta a candidatar-se se for necessário, para que o seu filho continue a receber refeições gratuitas <strong>e a escola mantenha o seu financiamento Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Todas as crianças do Reception, Year 1 e Year 2 recebem refeições escolares gratuitas automaticamente, qualquer que seja o rendimento da família. Se recebe Universal Credit, <strong>informe mesmo assim a secretaria da escola e inscreva-se</strong>. Isto trará também à escola um financiamento adicional chamado <strong>Pupil Premium</strong>, usado para apoiar os resultados educativos de todos os alunos.</p>',
    how_to_intro: 'Cerca de uma hora do seu tempo.',
    cta_secondary_body_html:
      'Pode ter direito. Um calculador de benefícios gratuito e confidencial dir-lhe-á se poderia ter direito ao Universal Credit e a refeições escolares gratuitas.',
    label_how_to_claim: 'COMO PEDIR ESTES BENEFÍCIOS',
  },
  es: {
    cta_primary_title: 'Regístrese a partir del 1 de junio de 2026',
    box1_body_html:
      '<p>A partir del <strong>próximo curso escolar (2026/27)</strong>, la elegibilidad se comprobará cada año. En algunas zonas, su ayuntamiento inscribirá automáticamente a su hijo — compruébelo en el sitio web de la escuela o del ayuntamiento — y, de lo contrario, asegúrese de volver a solicitarlo si es necesario, para que su hijo siga recibiendo comidas gratuitas <strong>y la escuela conserve su financiación Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Todos los niños de Reception, Year 1 y Year 2 reciben comidas escolares gratuitas automáticamente, sea cual sea el ingreso familiar. Si recibe Universal Credit, <strong>informe igualmente a la secretaría de la escuela y regístrese</strong>. Esto también aportará a la escuela una financiación adicional llamada <strong>Pupil Premium</strong>, que se utiliza para apoyar los resultados educativos de todos los alumnos.</p>',
    how_to_intro: 'Alrededor de una hora de su tiempo.',
    cta_secondary_body_html:
      'Puede que tenga derecho. Una calculadora de prestaciones gratuita y confidencial le dirá si podría tener derecho al Universal Credit y a comidas escolares gratuitas.',
    label_how_to_claim: 'CÓMO SOLICITAR ESTAS PRESTACIONES',
  },
  bn: {
    cta_primary_title: '১ জুন ২০২৬ থেকে নিবন্ধন করুন',
    box1_body_html:
      '<p><strong>পরবর্তী (২০২৬/২৭) স্কুল বছর</strong> থেকে যোগ্যতা প্রতি বছর যাচাই করা হবে। কিছু এলাকায় আপনার লোকাল অথরিটি স্বয়ংক্রিয়ভাবে আপনার সন্তানকে নথিভুক্ত করবে — স্কুল বা কাউন্সিলের ওয়েবসাইটে দেখে নিন — অন্যথায় প্রয়োজন হলে আবার আবেদন করতে ভুলবেন না, যাতে আপনার সন্তান বিনামূল্যে মিল পেতে থাকে <strong>এবং স্কুল তার Pupil Premium তহবিল ধরে রাখে</strong>।</p>',
    box3_body_html:
      '<p>Reception, Year 1 ও Year 2-এর সব শিশু, পরিবারের আয় যাই হোক না কেন, স্বয়ংক্রিয়ভাবে বিনামূল্যে স্কুল মিল পায়। আপনি যদি Universal Credit পান, <strong>তবুও স্কুল অফিসে জানান এবং নিবন্ধন করুন</strong>। এতে স্কুলটি <strong>Pupil Premium</strong> নামে অতিরিক্ত তহবিলও পাবে, যা সব শিক্ষার্থীর শিক্ষাগত ফলাফলকে সহায়তা করতে ব্যবহার করা হয়।</p>',
    how_to_intro: 'আপনার সময়ের প্রায় এক ঘণ্টা।',
    cta_secondary_body_html:
      'আপনি হয়তো অধিকারী হতে পারেন। একটি বিনামূল্যে ও গোপনীয় বেনিফিট ক্যালকুলেটর আপনাকে জানাবে আপনি Universal Credit এবং বিনামূল্যে স্কুল মিলের জন্য যোগ্য কিনা।',
    label_how_to_claim: 'এই সুবিধাগুলির জন্য কীভাবে আবেদন করবেন',
  },
  gu: {
    cta_primary_title: '1 જૂન 2026 થી નોંધણી કરો',
    box1_body_html:
      '<p><strong>આગામી (2026/27) શાળા વર્ષ</strong> થી, પાત્રતા દર વર્ષે તપાસવામાં આવશે. કેટલાક વિસ્તારોમાં તમારી લોકલ ઓથોરિટી તમારા બાળકને આપમેળે નોંધણી કરશે — શાળા અથવા કાઉન્સિલની વેબસાઇટ પર તપાસો — નહીંતર જરૂર પડ્યે ફરીથી અરજી કરવાનું ભૂલશો નહીં, જેથી તમારા બાળકને મફત ભોજન મળતું રહે <strong>અને શાળાને તેનું Pupil Premium ભંડોળ મળતું રહે</strong>.</p>',
    box3_body_html:
      '<p>Reception, Year 1 અને Year 2 ના બધાં બાળકો, કુટુંબની આવક ગમે તે હોય, આપમેળે મફત શાળા ભોજન મેળવે છે. જો તમે Universal Credit મેળવતા હો, તો <strong>તેમ છતાં શાળાની ઓફિસને જણાવો અને નોંધણી કરો</strong>. આથી શાળાને <strong>Pupil Premium</strong> નામનું વધારાનું ભંડોળ પણ મળશે, જે બધા વિદ્યાર્થીઓના શૈક્ષણિક પરિણામોને ટેકો આપવા વપરાય છે.</p>',
    how_to_intro: 'તમારા સમયનો આશરે એક કલાક.',
    cta_secondary_body_html:
      'તમે કદાચ હકદાર હોઈ શકો છો. એક મફત અને ગોપનીય બેનિફિટ કેલ્ક્યુલેટર તમને જણાવશે કે તમે Universal Credit અને મફત શાળા ભોજન માટે પાત્ર છો કે કેમ.',
    label_how_to_claim: 'આ લાભો માટે કેવી રીતે અરજી કરવી',
  },
  it: {
    cta_primary_title: 'Iscrivetevi dal 1° giugno 2026',
    box1_body_html:
      '<p>Dal <strong>prossimo anno scolastico (2026/27)</strong>, l\'idoneità sarà verificata ogni anno. In alcune zone l\'autorità locale iscriverà automaticamente vostro figlio — verificate sul sito della scuola o del comune — altrimenti assicuratevi di ripresentare la domanda se necessario, in modo che vostro figlio continui a ricevere i pasti gratuiti <strong>e la scuola mantenga il suo finanziamento Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Tutti i bambini di Reception, Year 1 e Year 2 ricevono automaticamente i pasti scolastici gratuiti, qualunque sia il reddito familiare. Se ricevete Universal Credit, <strong>informate comunque la segreteria della scuola e iscrivetevi</strong>. In questo modo la scuola riceverà anche un finanziamento aggiuntivo chiamato <strong>Pupil Premium</strong>, usato per sostenere i risultati educativi di tutti gli alunni.</p>',
    how_to_intro: 'Circa un\'ora del vostro tempo.',
    cta_secondary_body_html:
      'Potreste averne diritto. Un calcolatore di benefici gratuito e riservato vi dirà se potreste avere diritto a Universal Credit e ai pasti scolastici gratuiti.',
    label_how_to_claim: 'COME RICHIEDERE QUESTI BENEFICI',
  },
  cy: {
    cta_primary_title: 'Cofrestrwch o 1 Mehefin 2026',
    box1_body_html:
      '<p>O\'r <strong>flwyddyn ysgol nesaf (2026/27)</strong>, bydd cymhwysedd yn cael ei wirio bob blwyddyn. Mewn rhai ardaloedd bydd eich awdurdod lleol yn cofrestru eich plentyn yn awtomatig — gwiriwch ar wefan yr ysgol neu\'r cyngor — fel arall, gwnewch yn siŵr eich bod yn gwneud cais eto os oes angen, fel bod eich plentyn yn cadw ei brydau am ddim <strong>a bod yr ysgol yn cadw ei chyllid Pupil Premium</strong>.</p>',
    box3_body_html:
      '<p>Mae pob plentyn yn Reception, Year 1 a Year 2 yn cael prydau ysgol am ddim yn awtomatig, beth bynnag yw incwm y teulu. Os ydych yn cael Universal Credit, <strong>dywedwch wrth swyddfa\'r ysgol a chofrestrwch beth bynnag</strong>. Bydd hyn hefyd yn dod â chyllid ychwanegol o\'r enw <strong>Pupil Premium</strong> i\'r ysgol, a ddefnyddir i gefnogi canlyniadau addysgol pob disgybl.</p>',
    how_to_intro: 'Tua awr o\'ch amser.',
    cta_secondary_body_html:
      'Efallai eich bod yn gymwys. Bydd cyfrifiannell budd-daliadau am ddim a chyfrinachol yn dweud wrthych a allech fod yn gymwys i gael Universal Credit a phrydau ysgol am ddim.',
    label_how_to_claim: 'SUT I HAWLIO\'R BUDD-DALIADAU HYN',
  },
};

const GENERIC_SECTIONS = ['nawra', 'cab', 'housing-association'];
const ALL_SECTIONS = ['nawra', 'cab', 'housing-association', 'entitledto-la'];

function main() {
  const dir = path.resolve(config.paths.serverRoot, 'data', 'translations');
  let count = 0;
  for (const [lang, six] of Object.entries(REV)) {
    const file = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(file)) { console.warn(`  skip ${lang}: no file`); continue; }
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
    for (const slug of ALL_SECTIONS) {
      const sec = doc[slug];
      if (!sec || typeof sec !== 'object') continue;
      sec.cta_primary_title = six.cta_primary_title;
      sec.box1_body_html = six.box1_body_html;
      sec.box3_body_html = six.box3_body_html;
      sec.how_to_intro = six.how_to_intro;
      sec.label_how_to_claim = six.label_how_to_claim;
      // Generic calculator line only — leave the entitledto-la promo as-is.
      if (GENERIC_SECTIONS.includes(slug)) sec.cta_secondary_body_html = six.cta_secondary_body_html;
    }
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    count += 1;
    console.log(`  ${lang}.json updated (6 fields × sections)`);
  }
  console.log(`Done: ${count} language files updated for the leaflet revision.`);
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('apply-leaflet-rev-translations.ts') || entry.endsWith('apply-leaflet-rev-translations.js'))) {
  main();
}
