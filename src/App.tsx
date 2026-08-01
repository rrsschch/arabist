import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, BarChart3, Bell, Bookmark, BookOpen, Check, ChevronRight, CircleHelp, FolderPlus,
  Home as HomeIcon, Library as LibraryIcon, LoaderCircle, Moon, Plus, RotateCcw,
  Search, Settings, Sparkles, Sun, Trash2, UserRound, Volume2, X, Zap,
} from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  genderLabels, hasDetails, posLabels, repositories, resetDemoData,
  type Accent, type Lexeme, type PartOfSpeech, type Profile, type ReviewGrade,
  type ThemePreference, type TrainingMode,
} from './core'
import { useTelegram, useTelegramBack } from './telegram'

const queryKeys = { lexemes: ['lexemes'], library: ['library'], profile: ['profile'] }

export function App() {
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: () => repositories.profile.get() })
  const { colorScheme } = useTelegram()
  useEffect(() => {
    const preference = profile.data?.theme ?? 'telegram'
    const resolved = preference === 'telegram' ? colorScheme : preference
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.accent = profile.data?.accent ?? 'blue'
  }, [profile.data?.theme, profile.data?.accent, colorScheme])
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="dictionary" element={<Dictionary />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:folderId" element={<Library />} />
        <Route path="library/:folderId/decks/:deckId" element={<Library />} />
        <Route path="training" element={<Training />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="lexemes/:id" element={<LexemeDetail />} />
      <Route path="training/session/:sessionId" element={<TrainingSessionPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function AppShell() {
  return (
    <>
      <main className="app-shell"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Основная навигация">
        <NavItem to="/" label="Главная" icon={<HomeIcon size={20} />} end />
        <NavItem to="/dictionary" label="Словарь" icon={<Search size={20} />} />
        <NavItem to="/training" label="Тренажёр" icon={<Zap size={20} />} />
        <NavItem to="/library" label="Колоды" icon={<LibraryIcon size={20} />} />
        <NavItem to="/profile" label="Профиль" icon={<UserRound size={20} />} />
      </nav>
    </>
  )
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{icon}<span>{label}</span></NavLink>
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="mb-6 flex items-start justify-between gap-4"><div><h1 className="page-title">{title}</h1>{subtitle && <p className="muted mt-1 text-sm font-medium">{subtitle}</p>}</div>{action}</header>
}

function LoadingState({ label = 'Загружаем…' }: { label?: string }) {
  return <div className="card grid min-h-40 place-items-center p-8 muted" role="status"><div className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={20} />{label}</div></div>
}
function ErrorState({ error }: { error: unknown }) {
  return <div className="card p-6 text-center" role="alert"><CircleHelp className="mx-auto mb-2 text-rose-500" /><strong>Что-то пошло не так</strong><p className="muted mt-1 text-sm">{error instanceof Error ? error.message : 'Попробуйте ещё раз'}</p></div>
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="card p-8 text-center"><Sparkles className="accent mx-auto mb-3" /><h2 className="font-extrabold">{title}</h2><p className="muted mt-1 text-sm">{text}</p></div>
}

function Home() {
  const navigate = useNavigate()
  const words = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list() })
  const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: () => repositories.profile.get() })
  const saved = library.data?.decks.reduce((sum, deck) => sum + deck.wordIds.length, 0) ?? 0
  return <>
    <PageHeader title={`Салам, ${profile.data?.name ?? 'Ученик'}!`} subtitle="Небольшой шаг каждый день" />
    <section className="card relative overflow-hidden p-6">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div><p className="eyebrow">Повторение SRS</p><h2 className="mt-2 text-2xl font-black">Готово к<br />повторению</h2><p className="mt-2"><span className="accent text-5xl font-black">24</span> <span className="muted text-sm">слова</span></p></div>
        <ProgressRing value={75} />
      </div>
      <button className="button button-primary relative mt-6 w-full" onClick={() => navigate('/training')}>Начать сессию <ChevronRight size={18} /></button>
    </section>
    <button className="card mt-5 flex w-full items-center gap-3 p-4 text-left" onClick={() => navigate('/dictionary')}><Search className="muted" /><span className="muted flex-1">Поиск слова или корня…</span><ChevronRight className="accent" /></button>
    <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold">Мои колоды</h2><Link className="accent text-sm font-bold" to="/library">Все</Link></div>
      {library.isPending ? <LoadingState /> : <div className="grid grid-cols-2 gap-3">{library.data?.decks.slice(0, 4).map((deck) => <Link key={deck.id} to={`/library/${deck.folderId}/decks/${deck.id}`} className="card min-h-34 p-4 text-inherit no-underline"><span className="text-2xl">{deck.emoji}</span><h3 className="mt-3 text-sm font-extrabold">{deck.title}</h3><p className="muted mt-1 text-xs">{deck.wordIds.length} слов</p></Link>)}</div>}
    </section>
    <section className="card mt-6 flex items-center justify-between p-4"><div><p className="eyebrow">Словарь</p><p className="mt-1 font-extrabold">{words.data?.length ?? '…'} слов</p></div><div className="text-right"><p className="eyebrow">Сохранено</p><p className="mt-1 font-extrabold">{saved}</p></div></section>
  </>
}

function ProgressRing({ value }: { value: number }) {
  return <div className="relative grid h-18 w-18 place-items-center rounded-full" style={{ background: `conic-gradient(var(--accent) ${value}%, var(--border) 0)` }} aria-label={`Прогресс ${value}%`}><div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface)] text-sm font-black">{value}%</div></div>
}

function Dictionary() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [pos, setPos] = useState<PartOfSpeech | 'all'>((params.get('pos') as PartOfSpeech) ?? 'all')
  const [saveWord, setSaveWord] = useState<Lexeme | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => setParams((old) => {
      const next = new URLSearchParams(old)
      if (query) next.set('q', query)
      else next.delete('q')
      if (pos !== 'all') next.set('pos', pos)
      else next.delete('pos')
      return next
    }, { replace: true }), 180)
    return () => clearTimeout(timer)
  }, [query, pos, setParams])
  const results = useQuery({ queryKey: ['search', query, pos], queryFn: () => repositories.lexemes.search({ query, pos, limit: 100 }) })
  return <>
    <PageHeader title="Словарь" subtitle="918 проверенных слов из словаря Баранова" />
    <div className="sticky top-0 z-20 -mx-2 mb-4 space-y-3 bg-[var(--surface-muted)]/95 px-2 pb-3 backdrop-blur">
      <label className="relative block"><span className="sr-only">Поиск слов</span><Search className="muted absolute left-4 top-4" size={20} /><input className="input pl-12 pr-12" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Слово, перевод или корень…" />{query && <button className="button button-ghost icon-button absolute right-1 top-1" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={19} /></button>}</label>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Фильтр части речи">{(['all', 'noun', 'verb', 'particle'] as const).map((item) => <button key={item} className="chip" aria-pressed={pos === item} onClick={() => setPos(item)}>{item === 'all' ? 'Все' : posLabels[item]}</button>)}</div>
    </div>
    {results.isPending ? <LoadingState label="Открываем словарь…" /> : results.isError ? <ErrorState error={results.error} /> : results.data.length === 0 ? <EmptyState title="Ничего не найдено" text="Попробуйте слово без огласовок или другой перевод." /> : <div className="word-list">{results.data.map((word) => <WordRow key={word.id} word={word} onSave={() => setSaveWord(word)} />)}</div>}
    {saveWord && <SaveDialog word={saveWord} onClose={() => setSaveWord(null)} />}
  </>
}

function WordRow({ word, onSave }: { word: Lexeme; onSave?: () => void }) {
  return <article className="card word-card"><Link to={`/lexemes/${word.id}`} className="min-w-0 text-inherit no-underline"><div className="flex items-center gap-2"><span className={`pos-badge pos-${word.pos}`}>{posLabels[word.pos]}</span>{word.details.root && <span className="muted font-arabic text-sm" dir="rtl">{word.details.root}</span>}</div><p className="font-arabic mt-2 text-right text-4xl font-bold" dir="rtl">{word.word_ar}</p><p className="mt-2 line-clamp-2 text-sm font-semibold">{word.translations.join('; ')}</p></Link>{onSave && <button className="button button-ghost icon-button self-center" aria-label={`Сохранить ${word.word_ar}`} onClick={onSave}><Bookmark size={21} /></button>}</article>
}

function SaveDialog({ word, onClose }: { word: Lexeme; onClose(): void }) {
  const queryClient = useQueryClient(); const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const mutation = useMutation({ mutationFn: (deckId: string) => repositories.library.toggleLexeme(deckId, word.id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.library }); onClose() } })
  return <Dialog title="Сохранить в колоду" onClose={onClose}><p className="font-arabic mb-4 text-center text-5xl" dir="rtl">{word.word_ar}</p><div className="grid gap-2">{library.data?.decks.map((deck) => <button className="button button-secondary justify-between" key={deck.id} onClick={() => mutation.mutate(deck.id)}><span>{deck.emoji} {deck.title}</span>{deck.wordIds.includes(word.id) && <Check size={18} />}</button>)}</div></Dialog>
}

function LexemeDetail() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const [saveOpen, setSaveOpen] = useState(false)
  const word = useQuery({ queryKey: ['lexeme', id], queryFn: () => repositories.lexemes.get(id) })
  const goBack = useCallback(() => navigate(-1), [navigate]); useTelegramBack(true, goBack)
  if (word.isPending) return <Standalone><LoadingState /></Standalone>
  if (word.isError) return <Standalone><ErrorState error={word.error} /></Standalone>
  if (!word.data) return <Navigate to="/dictionary" replace />
  const item = word.data
  return <Standalone>
    <header className="mb-4 flex items-center justify-between"><button className="button button-ghost icon-button" onClick={goBack} aria-label="Назад"><ArrowLeft /></button><strong>Арабский словарь</strong><button className="button button-ghost icon-button" disabled aria-label="Озвучивание пока недоступно" title="Озвучивание скоро"><Volume2 /></button></header>
    <article className="card p-6 text-center"><div className="flex justify-between"><div className="text-left"><span className="eyebrow">Корень</span><p className="font-arabic mt-1 text-xl" dir="rtl">{item.details.root ?? '—'}</p></div><span className={`pos-badge pos-${item.pos} self-start`}>{posLabels[item.pos]}</span></div><p className="font-arabic mt-10 text-7xl leading-tight" dir="rtl">{item.word_ar}</p><button className="button button-ghost icon-button ml-auto mt-2" onClick={() => setSaveOpen(true)} aria-label="Сохранить слово"><Bookmark /></button><div className="my-4 h-px bg-[var(--border)]" /><ul className="grid gap-2 text-left">{item.translations.map((translation, index) => <li className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm font-semibold" key={index}>{translation}</li>)}</ul></article>
    {hasDetails(item) && <section className="card mt-4 p-5"><h2 className="text-lg font-extrabold">{item.pos === 'verb' ? 'Формы глагола' : item.pos === 'noun' ? 'Сведения об имени' : 'Дополнение'}</h2><div className="mt-4 grid grid-cols-2 gap-3">{detailRows(item).map(([label, value]) => <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-center" key={label}><span className="eyebrow">{label}</span><p className="font-arabic mt-1 text-xl font-bold" dir={/[\u0600-\u06ff]/.test(value) ? 'rtl' : undefined}>{value}</p></div>)}</div></section>}
    <section className="mt-4"><h2 className="mb-3 text-lg font-extrabold">Примеры</h2>{item.examples.length ? <div className="grid gap-3">{item.examples.map((example, index) => <p key={index} className="card p-4 text-sm leading-7">{example}</p>)}</div> : <EmptyState title="Примеров пока нет" text="Они появятся после расширения словарной базы." />}</section>
    {saveOpen && <SaveDialog word={item} onClose={() => setSaveOpen(false)} />}
  </Standalone>
}

function detailRows(word: Lexeme): [string, string][] {
  const d = word.details; const rows: [string, string | null][] = [['Корень', d.root], ['Порода', d.form], ['Гласная', d.present_vowel], ['Масдар', d.masdar], ['Мн. число', d.plural], ['Род', d.gender ? genderLabels[d.gender] : null]]
  return rows.filter((row): row is [string, string] => Boolean(row[1]))
}

function Library() {
  const { folderId, deckId } = useParams(); const queryClient = useQueryClient(); const navigate = useNavigate(); const [create, setCreate] = useState<'folder' | 'deck' | null>(null)
  const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const deck = library.data?.decks.find((item) => item.id === deckId); const folder = library.data?.folders.find((item) => item.id === folderId)
  const words = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list(), enabled: Boolean(deck) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.library })
  if (library.isPending) return <LoadingState />
  if (library.isError) return <ErrorState error={library.error} />
  if (deck) return <><PageHeader title={`${deck.emoji} ${deck.title}`} subtitle={`${deck.wordIds.length} слов`} action={<button className="button button-ghost icon-button" onClick={() => navigate(`/library/${deck.folderId}`)} aria-label="Назад"><ArrowLeft /></button>} />{deck.wordIds.length && words.data ? <div className="word-list">{deck.wordIds.map((id) => words.data.find((word) => word.id === id)).filter(Boolean).map((word) => <WordRow key={word!.id} word={word!} />)}</div> : <EmptyState title="Колода пустая" text="Сохраняйте слова из словаря — они появятся здесь." />}</>
  if (folder) { const decks = library.data.decks.filter((item) => item.folderId === folder.id); return <><PageHeader title={`${folder.emoji} ${folder.title}`} subtitle={`${decks.length} колод`} action={<button className="button button-ghost icon-button" onClick={() => navigate('/library')} aria-label="Назад"><ArrowLeft /></button>} /><div className="grid gap-3">{decks.map((item) => <LibraryTile key={item.id} emoji={item.emoji} title={item.title} subtitle={`${item.wordIds.length} слов`} to={`/library/${folder.id}/decks/${item.id}`} onDelete={async () => { if (confirm(`Удалить колоду «${item.title}»?`)) { await repositories.library.remove('deck', item.id); await refresh() } }} />)}</div><button className="button button-primary mt-4 w-full" onClick={() => setCreate('deck')}><Plus /> Новая колода</button>{create && <CreateDialog type={create} folderId={folder.id} onClose={() => setCreate(null)} />}</> }
  return <><PageHeader title="Мои колоды" subtitle="Организуйте слова по темам" action={<button className="button button-secondary icon-button" onClick={() => setCreate('folder')} aria-label="Создать папку"><FolderPlus /></button>} /><div className="grid gap-3">{library.data.folders.map((item) => <LibraryTile key={item.id} emoji={item.emoji} title={item.title} subtitle={`${library.data.decks.filter((deckItem) => deckItem.folderId === item.id).length} колод`} to={`/library/${item.id}`} onDelete={async () => { if (confirm(`Удалить папку «${item.title}» и её колоды?`)) { await repositories.library.remove('folder', item.id); await refresh() } }} />)}</div>{create && <CreateDialog type={create} onClose={() => setCreate(null)} />}</>
}

function LibraryTile({ emoji, title, subtitle, to, onDelete }: { emoji: string; title: string; subtitle: string; to: string; onDelete(): void }) {
  return <div className="card flex items-center gap-3 p-3"><Link to={to} className="flex min-w-0 flex-1 items-center gap-3 text-inherit no-underline"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl">{emoji}</span><div><h2 className="font-extrabold">{title}</h2><p className="muted text-xs">{subtitle}</p></div><ChevronRight className="muted ml-auto" /></Link><button className="button button-ghost icon-button" aria-label={`Удалить ${title}`} onClick={onDelete}><Trash2 size={18} /></button></div>
}

function CreateDialog({ type, folderId, onClose }: { type: 'folder' | 'deck'; folderId?: string; onClose(): void }) {
  const [value, setValue] = useState(''); const queryClient = useQueryClient()
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!value.trim()) return; if (type === 'folder') await repositories.library.createFolder(value.trim()); else await repositories.library.createDeck(folderId!, value.trim()); await queryClient.invalidateQueries({ queryKey: queryKeys.library }); onClose() }
  return <Dialog title={type === 'folder' ? 'Новая папка' : 'Новая колода'} onClose={onClose}><form onSubmit={submit}><label className="eyebrow" htmlFor="create-title">Название</label><input id="create-title" autoFocus className="input mt-2" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'folder' ? 'Например: Учебник' : 'Например: Путешествия'} /><button className="button button-primary mt-4 w-full" disabled={!value.trim()}>Создать</button></form></Dialog>
}

function Training() {
  const navigate = useNavigate(); const lexemes = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list() }); const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const start = useMutation({ mutationFn: async (mode: TrainingMode) => { const saved = [...new Set(library.data?.decks.flatMap((deck) => deck.wordIds) ?? [])]; const ids = saved.length ? saved.slice(0, 20) : (lexemes.data ?? []).slice(0, 20).map((word) => word.id); return repositories.reviews.start(mode, ids) }, onSuccess: (session) => navigate(`/training/session/${session.id}`) })
  return <><PageHeader title="Тренажёр" subtitle="Повторяйте и закрепляйте слова" /><section className="card overflow-hidden p-6 text-white" style={{ background: 'linear-gradient(145deg, var(--accent), #1e3a8a)' }}><p className="eyebrow !text-blue-100">Сегодня</p><h2 className="mt-2 text-2xl font-black">24 слова ждут<br />повторения</h2><button className="button mt-6 w-full bg-white text-blue-700" onClick={() => start.mutate('review')} disabled={start.isPending}>Начать повторение</button></section><h2 className="mb-3 mt-7 text-xl font-extrabold">Свободная практика</h2><div className="grid gap-3">{([{ mode: 'study', icon: <BookOpen />, title: 'Изучение новых', text: 'Слово, перевод и детали' }, { mode: 'flip', icon: <RotateCcw />, title: 'Флип-карточки', text: 'Вспомните перевод' }, { mode: 'quiz', icon: <CircleHelp />, title: 'Тест на знание', text: 'Быстрая самопроверка' }] as const).map((item) => <button key={item.mode} className="card flex items-center gap-4 p-4 text-left" onClick={() => start.mutate(item.mode)}><span className="soft-bg accent grid h-12 w-12 place-items-center rounded-2xl">{item.icon}</span><span className="flex-1"><strong className="block">{item.title}</strong><span className="muted text-xs">{item.text}</span></span><ChevronRight className="muted" /></button>)}</div></>
}

function TrainingSessionPage() {
  const { sessionId = '' } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [revealed, setRevealed] = useState(false)
  const session = useQuery({ queryKey: ['session', sessionId], queryFn: () => repositories.reviews.get(sessionId) }); const words = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list() })
  const close = useCallback(() => navigate('/training'), [navigate]); useTelegramBack(true, close)
  const answer = useMutation({ mutationFn: ({ wordId, grade }: { wordId: string; grade: ReviewGrade }) => repositories.reviews.answer(sessionId, wordId, grade), onSuccess: (next) => { queryClient.setQueryData(['session', sessionId], next); setRevealed(false); queryClient.invalidateQueries({ queryKey: queryKeys.profile }) } })
  if (session.isPending || words.isPending) return <Standalone><LoadingState label="Готовим карточки…" /></Standalone>
  if (session.isError || words.isError) return <Standalone><ErrorState error={session.error ?? words.error} /></Standalone>
  if (!session.data) return <Navigate to="/training" replace />
  if (session.data.completed) return <Standalone><div className="grid min-h-[80dvh] place-items-center"><div className="card w-full p-8 text-center"><span className="text-6xl">🎉</span><h1 className="page-title mt-4">Сессия завершена</h1><p className="muted mt-2">Повторено слов: {session.data.answers.length}</p><button className="button button-primary mt-6 w-full" onClick={close}>Вернуться в тренажёр</button></div></div></Standalone>
  const wordId = session.data.lexemeIds[session.data.cursor]; const word = words.data?.find((item) => item.id === wordId)
  if (!word) return <Standalone><ErrorState error={new Error('Слово не найдено')} /></Standalone>
  const progress = Math.round((session.data.cursor / session.data.lexemeIds.length) * 100)
  return <Standalone><header className="flex items-center gap-3"><button className="button button-ghost icon-button" onClick={close} aria-label="Закрыть тренировку"><X /></button><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} /></div><span className="muted text-xs font-bold">{session.data.cursor + 1}/{session.data.lexemeIds.length}</span></header><div className="grid min-h-[calc(100dvh-170px)] content-center"><article className="card p-7 text-center"><span className={`pos-badge pos-${word.pos}`}>{posLabels[word.pos]}</span><p className="font-arabic mt-10 text-7xl" dir="rtl">{word.word_ar}</p>{revealed && <div className="mt-8 border-t border-[var(--border)] pt-6"><p className="text-lg font-extrabold">{word.translations.join('; ')}</p>{word.details.root && <p className="muted font-arabic mt-3" dir="rtl">Корень: {word.details.root}</p>}</div>}</article>{!revealed ? <button className="button button-primary mt-4 w-full" onClick={() => setRevealed(true)}>Показать ответ</button> : <div className="mt-4 grid grid-cols-3 gap-2"><GradeButton label="Снова" grade="again" className="bg-rose-50 text-rose-700" onClick={(grade) => answer.mutate({ wordId, grade })} /><GradeButton label="Трудно" grade="hard" className="bg-amber-50 text-amber-700" onClick={(grade) => answer.mutate({ wordId, grade })} /><GradeButton label="Легко" grade="easy" className="bg-emerald-50 text-emerald-700" onClick={(grade) => answer.mutate({ wordId, grade })} /></div>}</div></Standalone>
}

function GradeButton({ label, grade, className, onClick }: { label: string; grade: ReviewGrade; className: string; onClick(grade: ReviewGrade): void }) { return <button className={`button ${className}`} onClick={() => onClick(grade)}>{label}</button> }

function ProfilePage() {
  const queryClient = useQueryClient(); const { user, isTelegram } = useTelegram(); const profile = useQuery({ queryKey: queryKeys.profile, queryFn: () => repositories.profile.get() })
  const update = useMutation({ mutationFn: (patch: Partial<Profile>) => repositories.profile.update(patch), onSuccess: (next) => queryClient.setQueryData(queryKeys.profile, next) })
  if (profile.isPending) return <LoadingState />; if (profile.isError) return <ErrorState error={profile.error} />
  const value = profile.data
  return <><PageHeader title="Профиль" subtitle={isTelegram ? 'Данные из Telegram' : 'Режим предпросмотра'} /><section className="card flex items-center gap-4 p-5">{user.photoUrl ? <img src={user.photoUrl} className="h-16 w-16 rounded-full object-cover" alt="" /> : <span className="accent-bg grid h-16 w-16 place-items-center rounded-full text-2xl font-black">{user.firstName[0]}</span>}<div><h2 className="text-xl font-black">{user.firstName || value.name}</h2><p className="muted text-sm">{user.username ? `@${user.username}` : 'Ученик арабского'}</p></div></section><div className="mt-4 grid grid-cols-3 gap-2">{[['Серия', `${value.streak} дн.`], ['Повторено', value.reviewedTotal], ['Цель', value.dailyGoal]].map(([label, stat]) => <div className="card p-3 text-center" key={label}><strong className="block text-lg">{stat}</strong><span className="muted text-[10px] uppercase">{label}</span></div>)}</div><section className="card mt-5 divide-y divide-[var(--border)] p-2"><SettingRow icon={<Bell />} label="Напоминания"><input type="checkbox" checked={value.notifications} onChange={(e) => update.mutate({ notifications: e.target.checked })} aria-label="Включить напоминания" /></SettingRow><SettingRow icon={<BarChart3 />} label="Дневная цель"><select className="rounded-lg bg-[var(--surface-muted)] p-2" value={value.dailyGoal} onChange={(e) => update.mutate({ dailyGoal: Number(e.target.value) })} aria-label="Дневная цель">{[10, 20, 30, 50].map((goal) => <option key={goal} value={goal}>{goal} слов</option>)}</select></SettingRow><SettingRow icon={value.theme === 'dark' ? <Moon /> : <Sun />} label="Тема"><select className="rounded-lg bg-[var(--surface-muted)] p-2" value={value.theme} onChange={(e) => update.mutate({ theme: e.target.value as ThemePreference })} aria-label="Тема"><option value="telegram">Telegram</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></SettingRow></section><section className="card mt-5 p-5"><h2 className="flex items-center gap-2 font-extrabold"><Settings size={19} /> Цветовой акцент</h2><div className="mt-4 flex justify-between">{(['blue', 'emerald', 'purple', 'rose', 'amber'] as Accent[]).map((accent) => <button key={accent} onClick={() => update.mutate({ accent })} className={`h-10 w-10 rounded-full bg-${accent}-500 shadow-sm`} style={{ background: accentColor(accent) }} aria-label={`Акцент ${accent}`} aria-pressed={value.accent === accent}>{value.accent === accent && <Check className="mx-auto text-white" size={18} />}</button>)}</div></section><button className="button button-secondary mt-5 w-full" onClick={() => { if (confirm('Сбросить все локальные колоды, настройки и прогресс?')) { resetDemoData(); location.reload() } }}><RotateCcw size={18} /> Сбросить демо-данные</button></>
}

function SettingRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) { return <div className="flex min-h-15 items-center gap-3 px-3 py-2"><span className="accent">{icon}</span><span className="flex-1 font-bold">{label}</span>{children}</div> }
function accentColor(accent: Accent) { return { blue: '#2563eb', emerald: '#059669', purple: '#7c3aed', rose: '#e11d48', amber: '#d97706' }[accent] }

function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const titleId = useId(); const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLElement>('button,input,select')?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); previous?.focus() } }, [onClose])
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="mb-5 flex items-center justify-between"><h2 id={titleId} className="text-xl font-black">{title}</h2><button className="button button-ghost icon-button" onClick={onClose} aria-label="Закрыть"><X /></button></header>{children}</div></div>
}

function Standalone({ children }: { children: ReactNode }) { return <main className="app-shell !pb-[calc(24px+var(--tg-safe-bottom))]">{children}</main> }
function NotFound() { return <Standalone><EmptyState title="Страница не найдена" text="Вернитесь на главную страницу приложения." /><Link className="button button-primary mt-4 w-full no-underline" to="/">На главную</Link></Standalone> }
