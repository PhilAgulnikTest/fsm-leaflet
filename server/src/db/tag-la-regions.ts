/* Tag known non-England LAs in la_clients with their actual region.
 *
 * Runs at boot via index.ts auto-seed. Idempotent: only updates rows still
 * sitting on the default 'england' tag, so platform admins can hand-edit a
 * row to e.g. 'scotland' and the next boot won't trample it (we only correct
 * the explicit known list below).
 *
 * The list is derived from the entitledto sites CSV — only LAs that are
 * obviously outside England are included. Add to this list as new non-England
 * clients are onboarded. */

import { db } from './index.js';

const NON_ENGLAND_LAS: Record<string, 'scotland' | 'wales' | 'northern-ireland'> = {
  // Scotland
  'aberdeen-city': 'scotland',
  'aberdeen': 'scotland',
  'aberdeenshire': 'scotland',
  'angus': 'scotland',
  'argyll-and-bute': 'scotland',
  'clackmannanshire': 'scotland',
  'dumfries-and-galloway': 'scotland',
  'dundee-city': 'scotland',
  'dundee': 'scotland',
  'east-ayrshire': 'scotland',
  'east-dunbartonshire': 'scotland',
  'east-lothian': 'scotland',
  'east-renfrewshire': 'scotland',
  'edinburgh': 'scotland',
  'falkirk': 'scotland',
  'fife': 'scotland',
  'glasgow': 'scotland',
  'glasgow-city': 'scotland',
  'highland': 'scotland',
  'inverclyde': 'scotland',
  'midlothian': 'scotland',
  'moray': 'scotland',
  'na-h-eileanan-siar': 'scotland',
  'north-ayrshire': 'scotland',
  'north-lanarkshire': 'scotland',
  'orkney': 'scotland',
  'orkney-islands': 'scotland',
  'perth-and-kinross': 'scotland',
  'renfrewshire': 'scotland',
  'scottish-borders': 'scotland',
  'shetland': 'scotland',
  'shetland-islands': 'scotland',
  'south-ayrshire': 'scotland',
  'south-lanarkshire': 'scotland',
  'stirling': 'scotland',
  'west-dunbartonshire': 'scotland',
  'west-lothian': 'scotland',

  // Wales
  'anglesey': 'wales',
  'blaenau-gwent': 'wales',
  'bridgend': 'wales',
  'caerphilly': 'wales',
  'cardiff': 'wales',
  'carmarthenshire': 'wales',
  'ceredigion': 'wales',
  'conwy': 'wales',
  'denbighshire': 'wales',
  'flintshire': 'wales',
  'gwynedd': 'wales',
  'isle-of-anglesey': 'wales',
  'merthyr-tydfil': 'wales',
  'monmouthshire': 'wales',
  'neath-port-talbot': 'wales',
  'newport': 'wales',
  'pembrokeshire': 'wales',
  'powys': 'wales',
  'rhondda-cynon-taf': 'wales',
  'swansea': 'wales',
  'torfaen': 'wales',
  'vale-of-glamorgan': 'wales',
  'wrexham': 'wales',

  // Northern Ireland
  'antrim-and-newtownabbey': 'northern-ireland',
  'ards-and-north-down': 'northern-ireland',
  'armagh-banbridge-and-craigavon': 'northern-ireland',
  'belfast': 'northern-ireland',
  'causeway-coast-and-glens': 'northern-ireland',
  'derry-and-strabane': 'northern-ireland',
  'fermanagh-and-omagh': 'northern-ireland',
  'lisburn-and-castlereagh': 'northern-ireland',
  'mid-and-east-antrim': 'northern-ireland',
  'mid-ulster': 'northern-ireland',
  'newry-mourne-and-down': 'northern-ireland',
};

export function tagLARegions(): { updated: number } {
  const upd = db.prepare('UPDATE la_clients SET region = ? WHERE slug = ? AND region = ?');
  let updated = 0;
  const tx = db.transaction(() => {
    for (const [slug, region] of Object.entries(NON_ENGLAND_LAS)) {
      const result = upd.run(region, slug, 'england');
      if (result.changes > 0) updated++;
    }
  });
  tx();
  return { updated };
}
