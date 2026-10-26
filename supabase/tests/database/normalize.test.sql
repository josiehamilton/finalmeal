begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select is(public.normalize_dish_name('  Tonkotsu   Ramen!! '), 'tonkotsu ramen', 'trims, collapses whitespace, drops punctuation');
select is(public.normalize_dish_name('Tacos Al Pastor'), 'taco al pastor', 'folds simple plurals');
select is(public.normalize_dish_name('Bánh Mì'), 'banh mi', 'removes accents (Vietnamese)');
select is(public.normalize_dish_name('Crème Brûlée'), 'creme brulee', 'removes accents (French)');
select is(public.normalize_dish_name('Tonkotsu Ramen (extra chashu)'), 'tonkotsu ramen extra chashu', 'turns parentheses into spaces');
select is(public.normalize_dish_name('Glass'), 'glass', 'keeps words ending in ss');
select is(public.normalize_dish_name('Gas'), 'gas', 'keeps words of 3 characters or fewer');

select * from finish();
rollback;
