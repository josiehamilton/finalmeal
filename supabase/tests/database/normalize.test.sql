begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select is(public.normalize_dish_name('  Tonkotsu   Ramen!! '), 'tonkotsu ramen', 'trims, collapses whitespace, drops punctuation');
select is(public.normalize_dish_name('Tacos Al Pastor'), 'taco al pastor', 'folds simple plurals');
select is(public.normalize_dish_name('Bánh Mì'), 'banh mi', 'removes accents (Vietnamese)');
select is(public.normalize_dish_name('Crème Brûlée'), 'creme brulee', 'removes accents (French)');
select is(public.normalize_dish_name('Tonkotsu Ramen (extra chashu)'), 'tonkotsu ramen extra chashu', 'turns parentheses into spaces');
select is(public.normalize_dish_name('Glass'), 'glass', 'keeps words ending in ss');
select is(public.normalize_dish_name('Gas'), 'gas', 'keeps words of 3 characters or fewer');

-- Scripts with combining marks keep their words whole
select isnt(
  public.normalize_dish_name('ข้าวซอย'), public.normalize_dish_name('ข่าวซอย'),
  'Thai words that differ only by tone mark get different keys'
);
select is(public.normalize_dish_name('ข้าวซอย'), 'ข้าวซอย', 'Thai word with tone mark stays whole');
select is(public.normalize_dish_name('मसाला डोसा'), 'मसाला डोसा', 'Devanagari words keep their vowel signs');
select is(public.normalize_dish_name('ラーメン 拉面'), 'ラーメン 拉面', 'CJK words are kept and split on spaces');
select is(public.normalize_dish_name('Ramen 🍜 Bowl'), 'ramen bowl', 'emoji separate words and are dropped');
select is(public.normalize_dish_name('mac & cheese + egg'), 'mac cheese egg', 'symbols such as & and + separate words');
select is(public.normalize_dish_name('!!! 🍜 ♥'), '', 'punctuation- and emoji-only names normalise to empty');
select is(public.normalize_dish_name('👨' || chr(8205) || '🍳 chef'), 'chef', 'emoji joiners do not leave stray characters');
select is(public.normalize_dish_name('می' || chr(8204) || 'خواهم'), 'می' || chr(8204) || 'خواهم', 'keeps a zero-width non-joiner inside a Persian word');

select * from finish();
rollback;
