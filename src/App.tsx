import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, BarChart3, Bell, Bookmark, BookOpen, Check, ChevronRight, CircleHelp, EllipsisVertical,
  Home as HomeIcon, Library as LibraryIcon, ListChecks, LoaderCircle, Moon, MoveRight, Pencil, Plus,
  RotateCcw, Search, Settings, Sparkles, Sun, Trash2, UserRound, Volume2, X, Zap,
} from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  buildTrainingQueue, calculateRubberBandOffset, genderLabels, hasDetails, posLabels, repositories, resetDemoData,
  type Accent, type CatalogLexeme, type Deck, type PartOfSpeech, type Profile, type ReviewGrade,
  type ThemePreference, type TrainingMode, type UserLexeme, type UserLexemeInput,
} from './core'
import { useTelegram, useTelegramBack } from './telegram'

const queryKeys = { lexemes: ['lexemes'], userLexemes: ['user-lexemes'], library: ['library'], profile: ['profile'] }

export function App() {
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: () => repositories.profile.get() })
  const queryClient = useQueryClient()
  const { colorScheme, user, isTelegram } = useTelegram()
  useEffect(() => {
    repositories.userLexemes.setUserKey(isTelegram ? String(user.id) : 'demo')
    queryClient.invalidateQueries({ queryKey: queryKeys.lexemes })
    queryClient.invalidateQueries({ queryKey: queryKeys.userLexemes })
    queryClient.invalidateQueries({ queryKey: ['search'] })
  }, [isTelegram, queryClient, user.id])
  useEffect(() => {
    const preference = profile.data?.theme ?? 'telegram'
    const resolved = preference === 'telegram' ? colorScheme : preference
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.accent = profile.data?.accent ?? 'blue'
  }, [profile.data?.theme, profile.data?.accent, colorScheme])
  return (
    <div className="app-viewport"><Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="dictionary" element={<Dictionary />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:deckId" element={<Library />} />
        <Route path="library/:folderId/decks/:deckId" element={<LegacyLibraryRedirect />} />
        <Route path="training" element={<Training />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="lexemes/:id" element={<LexemeDetail />} />
      <Route path="training/session/:sessionId" element={<TrainingSessionPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes></div>
  )
}

function AppShell() {
  const location = useLocation()
  const scrollRef = useRubberBand<HTMLDivElement>()
  const { selectionHaptic } = useTelegram()
  const sections = ['/', '/dictionary', '/training', '/library', '/profile']
  const activeIndex = Math.max(0, sections.findIndex((path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)))
  return (
    <>
      <main ref={scrollRef} className="app-scroll"><div className="app-shell rubber-content"><div className="route-content" key={location.pathname}><Outlet /></div></div></main>
      <nav className="bottom-nav" style={{ '--nav-index': activeIndex } as CSSProperties} aria-label="Основная навигация">
        <span className="nav-indicator" aria-hidden="true" />
        <NavItem to="/" label="Главная" icon={<HomeIcon size={20} />} onNavigate={selectionHaptic} end />
        <NavItem to="/dictionary" label="Словарь" icon={<Search size={20} />} onNavigate={selectionHaptic} />
        <NavItem to="/training" label="Тренажёр" icon={<Zap size={20} />} onNavigate={selectionHaptic} />
        <NavItem to="/library" label="Колоды" icon={<LibraryIcon size={20} />} onNavigate={selectionHaptic} />
        <NavItem to="/profile" label="Профиль" icon={<UserRound size={20} />} onNavigate={selectionHaptic} />
      </nav>
    </>
  )
}

function NavItem({ to, label, icon, onNavigate, end }: { to: string; label: string; icon: ReactNode; onNavigate(): void; end?: boolean }) {
  return <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{icon}<span>{label}</span></NavLink>
}

function useRubberBand<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const { isTelegram } = useTelegram()
  useEffect(() => {
    const scroller = ref.current
    if (!scroller || /iPhone|iPad|iPod/i.test(navigator.userAgent)) return
    let startY = 0
    const content = () => scroller.querySelector<HTMLElement>('.rubber-content')
    const reset = () => {
      const target = content(); if (!target) return
      target.classList.add('rubber-releasing'); target.style.setProperty('--rubber-y', '0px')
      window.setTimeout(() => target.classList.remove('rubber-releasing'), 320)
    }
    const onStart = (event: TouchEvent) => { startY = event.touches[0]?.clientY ?? 0 }
    const onMove = (event: TouchEvent) => {
      const current = event.touches[0]?.clientY ?? startY; const delta = current - startY
      const atTop = scroller.scrollTop <= 0; const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
      const offset = calculateRubberBandOffset(delta, atTop, atBottom, isTelegram)
      if (!offset) return
      content()?.style.setProperty('--rubber-y', `${offset}px`)
    }
    scroller.addEventListener('touchstart', onStart, { passive: true }); scroller.addEventListener('touchmove', onMove, { passive: true }); scroller.addEventListener('touchend', reset, { passive: true }); scroller.addEventListener('touchcancel', reset, { passive: true })
    return () => { scroller.removeEventListener('touchstart', onStart); scroller.removeEventListener('touchmove', onMove); scroller.removeEventListener('touchend', reset); scroller.removeEventListener('touchcancel', reset) }
  }, [isTelegram])
  return ref
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

function useStartTraining() {
  const navigate = useNavigate()
  const lexemes = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list() })
  const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const queue = lexemes.data && library.data ? buildTrainingQueue(library.data, lexemes.data) : []
  const mutation = useMutation({
    mutationFn: (mode: TrainingMode) => repositories.reviews.start(mode, queue),
    onSuccess: (session) => navigate(`/training/session/${session.id}`),
  })
  return {
    start: mutation.mutate,
    isPending: mutation.isPending,
    isReady: Boolean(lexemes.data && library.data && queue.length),
    queueSize: queue.length,
  }
}

function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const training = useStartTraining()
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/dictionary?q=${encodeURIComponent(value)}` : '/dictionary')
  }
  return <>
    <section className="card relative overflow-hidden p-6">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div><p className="eyebrow">Повторение SRS</p><h2 className="mt-2 text-2xl font-black">Готово к<br />повторению</h2><p className="mt-2"><span className="accent text-5xl font-black">{training.isReady ? training.queueSize : '…'}</span> <span className="muted text-sm">слов</span></p></div>
        <ProgressRing value={75} />
      </div>
      <button className="button button-primary relative mt-6 w-full" onClick={() => training.start('review')} disabled={!training.isReady || training.isPending}>Начать сессию <ChevronRight size={18} /></button>
    </section>
    <form className="search-field mt-5" role="search" onSubmit={submitSearch}><label><span className="sr-only">Поиск слова или корня</span><Search className="search-field-icon muted" size={20} /><input className="input search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск слова или корня…" /></label><button className="button button-ghost icon-button search-field-clear accent" type="submit" aria-label="Найти"><ChevronRight /></button></form>
    <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold">Мои колоды</h2><Link className="accent text-sm font-bold" to="/library">Все</Link></div>
      {library.isPending ? <LoadingState /> : <div className="grid grid-cols-2 gap-3">{library.data?.decks.slice(0, 4).map((deck) => <Link key={deck.id} to={`/library/${deck.id}`} className="card min-h-34 p-4 text-inherit no-underline"><span className="text-2xl">{deck.emoji}</span><h3 className="mt-3 text-sm font-extrabold">{deck.title}</h3><p className="muted mt-1 text-xs">{deck.wordIds.length} слов</p></Link>)}</div>}
    </section>
  </>
}

function ProgressRing({ value }: { value: number }) {
  return <div className="relative grid h-18 w-18 place-items-center rounded-full" style={{ background: `conic-gradient(var(--accent) ${value}%, var(--border) 0)` }} aria-label={`Прогресс ${value}%`}><div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface)] text-sm font-black">{value}%</div></div>
}

function Dictionary() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [source, setSource] = useState<'all' | 'user'>('all')
  const [saveWord, setSaveWord] = useState<CatalogLexeme | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setParams((old) => {
      const next = new URLSearchParams(old)
      if (query) next.set('q', query)
      else next.delete('q')
      next.delete('pos')
      return next
    }, { replace: true }), 180)
    return () => clearTimeout(timer)
  }, [query, setParams])
  const results = useQuery({ queryKey: ['search', query, source], queryFn: () => repositories.lexemes.search({ query, source, limit: 100 }) })
  return <>
    <div className="dictionary-tools">
      <div className="flex gap-2"><label className="search-field flex-1"><span className="sr-only">Поиск слов</span><Search className="search-field-icon muted" size={20} /><input className="input search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Слово, перевод или корень…" />{query && <button className="button button-ghost icon-button search-field-clear" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={19} /></button>}</label><button className="button button-primary icon-button shrink-0" aria-label="Добавить своё слово или фразу" onClick={() => setCreateOpen(true)}><Plus /></button></div>
      <div className="source-switch mt-3" role="radiogroup" aria-label="Источник слов"><button role="radio" aria-checked={source === 'all'} onClick={() => setSource('all')}>Все</button><button role="radio" aria-checked={source === 'user'} onClick={() => setSource('user')}>Мои</button></div>
    </div>
    {results.isPending ? <LoadingState label="Открываем словарь…" /> : results.isError ? <ErrorState error={results.error} /> : results.data.length === 0 ? <><EmptyState title={source === 'user' ? 'Своих слов пока нет' : 'Ничего не найдено'} text={source === 'user' ? 'Добавьте первое слово или фразу для личных тренировок.' : 'Попробуйте слово без огласовок или другой перевод.'} />{source === 'user' && <button className="button button-primary mt-4 w-full" onClick={() => setCreateOpen(true)}><Plus /> Добавить запись</button>}</> : <div className="word-list">{results.data.map((word) => <WordRow key={word.id} word={word} onSave={() => setSaveWord(word)} />)}</div>}
    {saveWord && <SaveDialog word={saveWord} onClose={() => setSaveWord(null)} />}
    {createOpen && <PersonalLexemeDialog onClose={() => setCreateOpen(false)} onSaved={(word) => { setCreateOpen(false); setSaveWord({ ...word, source: 'user' }) }} />}
  </>
}

function WordRow({ word, onSave, selected = false, onSelect }: { word: CatalogLexeme; onSave?: () => void; selected?: boolean; onSelect?: () => void }) {
  const content = <><div className="flex flex-wrap items-center gap-2">{word.pos ? <span className={`pos-badge pos-${word.pos}`}>{posLabels[word.pos]}</span> : <span className="pos-badge pos-personal">{word.kind === 'phrase' ? 'фраза' : 'слово'}</span>}{word.source === 'user' && <span className="personal-badge">Моё</span>}{word.details.root && <span className="muted font-arabic text-sm" dir="rtl">{word.details.root}</span>}</div><p className="font-arabic mt-2 text-right text-4xl font-bold" dir="rtl">{word.word_ar}</p><p className="mt-2 line-clamp-2 text-sm font-semibold">{word.translations.join('; ')}</p></>
  if (onSelect) return <button className="card word-card w-full text-left" aria-pressed={selected} aria-label={`${selected ? 'Снять выбор' : 'Выбрать'} ${word.word_ar}`} onClick={onSelect}><span className="min-w-0">{content}</span><span className="selection-check">{selected && <Check size={17} />}</span></button>
  return <article className="card word-card"><Link to={`/lexemes/${word.id}`} className="min-w-0 text-inherit no-underline">{content}</Link>{onSave && <button className="button button-ghost icon-button self-center" aria-label={`Сохранить ${word.word_ar}`} onClick={onSave}><Bookmark size={21} /></button>}</article>
}

function SaveDialog({ word, onClose }: { word: CatalogLexeme; onClose(): void }) {
  const queryClient = useQueryClient(); const navigate = useNavigate(); const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const mutation = useMutation({ mutationFn: (deckId: string) => repositories.library.toggleLexeme(deckId, word.id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.library }); onClose() } })
  const decks = library.data?.decks ?? []
  return <Dialog title="Сохранить в колоду" onClose={onClose}><p className="font-arabic mb-4 text-center text-5xl" dir="rtl">{word.word_ar}</p>{decks.length ? <div className="grid gap-2">{decks.map((deck) => <button className="button button-secondary justify-between" key={deck.id} onClick={() => mutation.mutate(deck.id)}><span>{deck.emoji} {deck.title}</span>{deck.wordIds.includes(word.id) && <Check size={18} />}</button>)}</div> : <div className="text-center"><p className="muted text-sm">Сначала создайте колоду для сохранения слов.</p><button className="button button-primary mt-4 w-full" onClick={() => { onClose(); navigate('/library') }}>Перейти к колодам</button></div>}</Dialog>
}

function LexemeDetail() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [saveOpen, setSaveOpen] = useState(false); const [editOpen, setEditOpen] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false)
  const word = useQuery({ queryKey: ['lexeme', id], queryFn: () => repositories.lexemes.get(id) })
  const goBack = useCallback(() => navigate(-1), [navigate]); useTelegramBack(true, goBack)
  if (word.isPending) return <Standalone><LoadingState /></Standalone>
  if (word.isError) return <Standalone><ErrorState error={word.error} /></Standalone>
  if (!word.data) return <Navigate to="/dictionary" replace />
  const item = word.data
  return <Standalone>
    <div className="mb-4"><button className="button button-ghost icon-button" onClick={goBack} aria-label="Назад"><ArrowLeft /></button></div>
    <article className="card p-6 text-center"><div className="flex justify-between"><div className="text-left"><span className="eyebrow">{item.source === 'user' ? 'Личная запись' : 'Корень'}</span><p className="font-arabic mt-1 text-xl" dir="rtl">{item.source === 'user' ? (item.kind === 'phrase' ? 'Фраза' : 'Слово') : item.details.root ?? '—'}</p></div>{item.pos ? <span className={`pos-badge pos-${item.pos} self-start`}>{posLabels[item.pos]}</span> : <span className="personal-badge self-start">Моё</span>}</div><div className="lexeme-word-actions"><button className="button button-ghost icon-button lexeme-audio-button" disabled aria-label="Озвучивание пока недоступно" title="Озвучивание скоро"><Volume2 /></button><p className="font-arabic lexeme-word" dir="rtl">{item.word_ar}</p><button className="button button-ghost icon-button lexeme-save-button" onClick={() => setSaveOpen(true)} aria-label="Сохранить слово"><Bookmark /></button></div><div className="my-4 h-px bg-[var(--border)]" /><ul className="grid gap-2 text-left">{item.translations.map((translation, index) => <li className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm font-semibold" key={index}>{translation}</li>)}</ul>{item.note && <p className="muted mt-4 rounded-xl border border-[var(--border)] p-3 text-left text-sm">{item.note}</p>}{item.source === 'user' && <div className="mt-4 grid grid-cols-2 gap-2"><button className="button button-secondary" onClick={() => setEditOpen(true)}><Pencil size={17} /> Изменить</button><button className="button danger-button" onClick={() => setDeleteOpen(true)}><Trash2 size={17} /> Удалить</button></div>}</article>
    {hasDetails(item) && <section className="card mt-4 p-5"><h2 className="text-lg font-extrabold">{item.pos === 'verb' ? 'Формы глагола' : item.pos === 'noun' ? 'Сведения об имени' : 'Дополнение'}</h2><div className="mt-4 grid grid-cols-2 gap-3">{detailRows(item).map(([label, value]) => <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-center" key={label}><span className="eyebrow">{label}</span><p className="font-arabic mt-1 text-xl font-bold" dir={/[\u0600-\u06ff]/.test(value) ? 'rtl' : undefined}>{value}</p></div>)}</div></section>}
    <section className="mt-4"><h2 className="mb-3 text-lg font-extrabold">Примеры</h2>{item.examples.length ? <div className="grid gap-3">{item.examples.map((example, index) => <p key={index} className="card p-4 text-sm leading-7">{example}</p>)}</div> : <EmptyState title="Примеров пока нет" text="Они появятся после расширения словарной базы." />}</section>
    {saveOpen && <SaveDialog word={item} onClose={() => setSaveOpen(false)} />}
    {editOpen && item.source === 'user' && <PersonalLexemeDialog entry={item} onClose={() => setEditOpen(false)} onSaved={(saved) => { queryClient.setQueryData(['lexeme', id], { ...saved, source: 'user' }); queryClient.invalidateQueries({ queryKey: queryKeys.lexemes }); queryClient.invalidateQueries({ queryKey: ['search'] }); setEditOpen(false) }} />}
    {deleteOpen && <ConfirmDialog title="Удалить личную запись?" text={`«${item.word_ar}» исчезнет из всех колод и будущих тренировок.`} confirmLabel="Удалить" destructive onClose={() => setDeleteOpen(false)} onConfirm={async () => { await repositories.userLexemes.remove(item.id); await repositories.library.removeLexemeEverywhere(item.id); await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.lexemes }), queryClient.invalidateQueries({ queryKey: queryKeys.library }), queryClient.invalidateQueries({ queryKey: ['search'] })]); navigate('/dictionary') }} />}
  </Standalone>
}

function detailRows(word: CatalogLexeme): [string, string][] {
  const d = word.details; const rows: [string, string | null][] = [['Корень', d.root], ['Порода', d.form], ['Гласная', d.present_vowel], ['Масдар', d.masdar], ['Мн. число', d.plural], ['Род', d.gender ? genderLabels[d.gender] : null]]
  return rows.filter((row): row is [string, string] => Boolean(row[1]))
}

function Library() {
  const { deckId } = useParams(); const queryClient = useQueryClient(); const navigate = useNavigate()
  const [create, setCreate] = useState(false); const [actionsDeck, setActionsDeck] = useState<Deck | null>(null); const [editingDeck, setEditingDeck] = useState<Deck | null>(null)
  const [managing, setManaging] = useState(false); const [selected, setSelected] = useState<string[]>([]); const [moveOpen, setMoveOpen] = useState(false)
  const [personalOpen, setPersonalOpen] = useState(false); const [confirmRemove, setConfirmRemove] = useState(false); const [confirmDeck, setConfirmDeck] = useState<Deck | null>(null)
  const library = useQuery({ queryKey: queryKeys.library, queryFn: () => repositories.library.get() })
  const deck = library.data?.decks.find((item) => item.id === deckId)
  const words = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list(), enabled: Boolean(deck) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.library })
  const closeDeck = useCallback(() => {
    if (managing) { setManaging(false); setSelected([]); return }
    navigate('/library')
  }, [managing, navigate])
  useEffect(() => { setManaging(false); setSelected([]); setMoveOpen(false) }, [deckId])
  useTelegramBack(Boolean(deck), closeDeck)
  if (library.isPending) return <LoadingState />
  if (library.isError) return <ErrorState error={library.error} />
  if (deckId && !deck) return <Navigate to="/library" replace />
  if (deck) {
    const deckWords = deck.wordIds.map((id) => words.data?.find((word) => word.id === id)).filter((word): word is CatalogLexeme => Boolean(word))
    const otherDecks = library.data.decks.filter((item) => item.id !== deck.id)
    const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    const finishAction = async () => { await refresh(); setSelected([]); setManaging(false); setMoveOpen(false) }
    return <>
      <div className="mb-5 flex items-center gap-3"><button className="button button-ghost icon-button" onClick={closeDeck} aria-label={managing ? 'Завершить управление' : 'Назад'}><ArrowLeft /></button><div className="min-w-0 flex-1"><h1 className="truncate text-xl font-extrabold">{deck.emoji} {deck.title}</h1><p className="muted text-xs">{deck.wordIds.length} слов</p></div>{deck.wordIds.length > 0 && <button className="button button-secondary" onClick={() => { setManaging((value) => !value); setSelected([]) }}><ListChecks size={18} /> {managing ? 'Готово' : 'Управление'}</button>}</div>
      <button className="button button-secondary mb-4 w-full" onClick={() => setPersonalOpen(true)}><Plus size={18} /> Добавить своё слово или фразу</button>
      {deck.wordIds.length && words.data ? <div className="word-list">{deckWords.map((word) => <WordRow key={word.id} word={word} selected={selected.includes(word.id)} onSelect={managing ? () => toggleSelected(word.id) : undefined} />)}</div> : <><EmptyState title="Колода пустая" text="Добавьте слова из словаря или создайте личную запись." /><Link className="button button-primary mt-4 w-full no-underline" to="/dictionary"><Search size={18} /> Открыть словарь</Link></>}
      {managing && selected.length > 0 && <><div className="h-28" /><div className="selection-bar" role="toolbar" aria-label="Действия с выбранными словами"><strong className="px-2 text-sm">{selected.length}</strong><button className="button button-secondary" onClick={() => setMoveOpen(true)}><MoveRight size={17} /> Переместить</button><button className="button danger-button" onClick={() => setConfirmRemove(true)}><Trash2 size={17} /> Убрать</button></div></>}
      {moveOpen && <MoveWordsDialog decks={otherDecks} count={selected.length} onClose={() => setMoveOpen(false)} onCreate={() => { setMoveOpen(false); setManaging(false); setSelected([]); navigate('/library') }} onMove={async (targetId) => { await repositories.library.moveLexemes(deck.id, targetId, selected); await finishAction() }} />}
      {personalOpen && <PersonalLexemeDialog deckId={deck.id} onClose={() => setPersonalOpen(false)} onSaved={() => { setPersonalOpen(false); queryClient.invalidateQueries({ queryKey: queryKeys.lexemes }); refresh() }} />}
      {confirmRemove && <ConfirmDialog title="Убрать слова из колоды?" text={`Выбранные записи (${selected.length}) останутся в словаре и других колодах.`} confirmLabel="Убрать" destructive onClose={() => setConfirmRemove(false)} onConfirm={async () => { await repositories.library.removeLexemes(deck.id, selected); setConfirmRemove(false); await finishAction() }} />}
    </>
  }
  return <><button className="button button-primary mb-4 w-full" onClick={() => setCreate(true)}><Plus /> Новая колода</button>{library.data.decks.length ? <div className="grid gap-3">{library.data.decks.map((item) => <LibraryTile key={item.id} deck={item} onActions={() => setActionsDeck(item)} />)}</div> : <EmptyState title="Колод пока нет" text="Создайте первую колоду и сохраняйте в неё слова из словаря." />}{create && <DeckDialog onClose={() => setCreate(false)} />}{editingDeck && <DeckDialog deck={editingDeck} onClose={() => setEditingDeck(null)} />}{actionsDeck && <DeckActionsDialog deck={actionsDeck} onClose={() => setActionsDeck(null)} onEdit={() => { setActionsDeck(null); setEditingDeck(actionsDeck) }} onDelete={() => { setConfirmDeck(actionsDeck); setActionsDeck(null) }} />}{confirmDeck && <ConfirmDialog title="Удалить колоду?" text={`«${confirmDeck.title}»: ${confirmDeck.wordIds.length} слов. Сами слова останутся в словаре.`} confirmLabel="Удалить" destructive onClose={() => setConfirmDeck(null)} onConfirm={async () => { await repositories.library.remove(confirmDeck.id); await refresh(); setConfirmDeck(null) }} />}</>
}

function PersonalLexemeDialog({ entry, deckId, onClose, onSaved }: { entry?: UserLexeme; deckId?: string; onClose(): void; onSaved?(entry: UserLexeme): void }) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<UserLexemeInput['kind']>(entry?.kind ?? 'word')
  const [wordAr, setWordAr] = useState(entry?.word_ar ?? '')
  const [translation, setTranslation] = useState(entry?.translations[0] ?? '')
  const [pos, setPos] = useState<PartOfSpeech | null>(entry?.pos ?? null)
  const [example, setExample] = useState(entry?.examples[0] ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try {
      const input = { kind, word_ar: wordAr, translation, pos: kind === 'phrase' ? null : pos, example, note }
      const saved = entry ? await repositories.userLexemes.update(entry.id, input) : await repositories.userLexemes.create(input)
      if (!entry && deckId) await repositories.library.toggleLexeme(deckId, saved.id)
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.lexemes }), queryClient.invalidateQueries({ queryKey: queryKeys.userLexemes }), queryClient.invalidateQueries({ queryKey: queryKeys.library }), queryClient.invalidateQueries({ queryKey: ['search'] })])
      onSaved?.(saved); if (!onSaved) onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись') }
  }
  return <Dialog title={entry ? 'Редактировать запись' : 'Своё слово или фраза'} onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <AppChoices label="Тип записи" value={kind} options={[['word', 'Слово'], ['phrase', 'Фраза']]} onChange={(value) => setKind(value as UserLexemeInput['kind'])} />
    <label><span className="eyebrow">Арабский текст</span><input className="input font-arabic mt-2 text-right text-xl" dir="rtl" value={wordAr} onChange={(event) => setWordAr(event.target.value)} placeholder="كِتَاب" autoFocus /></label>
    <label><span className="eyebrow">Перевод</span><input className="input mt-2" value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder="Книга" /></label>
    {kind === 'word' && <AppChoices label="Часть речи — необязательно" value={pos ?? 'none'} options={[['none', 'Не указана'], ['noun', 'Имя'], ['verb', 'Глагол'], ['particle', 'Частица']]} onChange={(value) => setPos(value === 'none' ? null : value as PartOfSpeech)} />}
    <label><span className="eyebrow">Пример — необязательно</span><textarea className="input textarea mt-2" value={example} onChange={(event) => setExample(event.target.value)} /></label>
    <label><span className="eyebrow">Личная заметка — необязательно</span><textarea className="input textarea mt-2" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {error && <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p>}
    <button className="button button-primary w-full" disabled={!wordAr.trim() || !translation.trim()}>{entry ? 'Сохранить изменения' : deckId ? 'Создать и добавить' : 'Создать'}</button>
  </form></Dialog>
}

function LegacyLibraryRedirect() {
  const { deckId = '' } = useParams()
  return <Navigate to={`/library/${deckId}`} replace />
}

function LibraryTile({ deck, onActions }: { deck: Deck; onActions(): void }) {
  return <div className="card flex items-center gap-3 p-3"><Link to={`/library/${deck.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-inherit no-underline"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl">{deck.emoji}</span><div><h2 className="font-extrabold">{deck.title}</h2><p className="muted text-xs">{deck.wordIds.length} слов</p></div><ChevronRight className="muted ml-auto" /></Link><button className="button button-ghost icon-button" aria-label={`Действия с колодой ${deck.title}`} onClick={onActions}><EllipsisVertical size={20} /></button></div>
}

function DeckActionsDialog({ deck, onClose, onEdit, onDelete }: { deck: Deck; onClose(): void; onEdit(): void; onDelete(): void }) {
  return <Dialog title={`${deck.emoji} ${deck.title}`} onClose={onClose}><div className="grid gap-2"><button className="button button-secondary justify-start" onClick={onEdit}><Pencil size={18} /> Редактировать</button><button className="button justify-start bg-rose-50 text-rose-700" onClick={onDelete}><Trash2 size={18} /> Удалить</button></div></Dialog>
}

const deckEmojis = ['✨', '📚', '⭐', '🧠', '✈️', '🍽️', '🏃', '👋']

function DeckDialog({ deck, onClose }: { deck?: Deck; onClose(): void }) {
  const [title, setTitle] = useState(deck?.title ?? ''); const [emoji, setEmoji] = useState(deck?.emoji ?? '✨'); const queryClient = useQueryClient()
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; if (deck) await repositories.library.updateDeck(deck.id, { title, emoji }); else await repositories.library.createDeck(title.trim(), emoji.trim() || '✨'); await queryClient.invalidateQueries({ queryKey: queryKeys.library }); onClose() }
  return <Dialog title={deck ? 'Редактировать колоду' : 'Новая колода'} onClose={onClose}><form onSubmit={submit}><label className="eyebrow" htmlFor="deck-title">Название</label><input id="deck-title" autoFocus className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Путешествия" /><label className="eyebrow mt-4 block" htmlFor="deck-emoji">Эмодзи</label><input id="deck-emoji" className="input mt-2 text-center text-2xl" value={emoji} maxLength={8} onChange={(event) => setEmoji(event.target.value)} /><div className="emoji-presets mt-3">{deckEmojis.map((item) => <button type="button" className="emoji-choice" key={item} aria-label={`Выбрать ${item}`} aria-pressed={emoji === item} onClick={() => setEmoji(item)}>{item}</button>)}</div><button className="button button-primary mt-5 w-full" disabled={!title.trim()}>{deck ? 'Сохранить' : 'Создать'}</button></form></Dialog>
}

function MoveWordsDialog({ decks, count, onClose, onCreate, onMove }: { decks: Deck[]; count: number; onClose(): void; onCreate(): void; onMove(deckId: string): void }) {
  return <Dialog title={`Переместить слова (${count})`} onClose={onClose}>{decks.length ? <div className="grid gap-2">{decks.map((deck) => <button className="button button-secondary justify-between" key={deck.id} onClick={() => onMove(deck.id)}><span>{deck.emoji} {deck.title}</span><ChevronRight size={18} /></button>)}</div> : <div className="text-center"><p className="muted text-sm">Для перемещения нужна ещё одна колода.</p><button className="button button-primary mt-4 w-full" onClick={onCreate}><Plus size={18} /> Создать колоду</button></div>}</Dialog>
}

function Training() {
  const training = useStartTraining()
  return <><section className="card overflow-hidden p-6 text-white" style={{ background: 'linear-gradient(145deg, var(--accent), #1e3a8a)' }}><p className="eyebrow !text-blue-100">Сегодня</p><h2 className="mt-2 text-2xl font-black">{training.isReady ? training.queueSize : '…'} слов ждут<br />повторения</h2><button className="button mt-6 w-full bg-white text-blue-700" onClick={() => training.start('review')} disabled={!training.isReady || training.isPending}>Начать повторение</button></section><h2 className="mb-3 mt-7 text-xl font-extrabold">Свободная практика</h2><div className="grid gap-3">{([{ mode: 'study', icon: <BookOpen />, title: 'Изучение новых', text: 'Слово, перевод и детали' }, { mode: 'flip', icon: <RotateCcw />, title: 'Тренировка', text: 'Вспомните перевод' }] as const).map((item) => <button key={item.mode} className="card flex items-center gap-4 p-4 text-left" onClick={() => training.start(item.mode)} disabled={!training.isReady || training.isPending}><span className="soft-bg accent grid h-12 w-12 place-items-center rounded-2xl">{item.icon}</span><span className="flex-1"><strong className="block">{item.title}</strong><span className="muted text-xs">{item.text}</span></span><ChevronRight className="muted" /></button>)}</div></>
}

function TrainingSessionPage() {
  const { sessionId = '' } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [revealed, setRevealed] = useState(false)
  const session = useQuery({ queryKey: ['session', sessionId], queryFn: () => repositories.reviews.get(sessionId) }); const words = useQuery({ queryKey: queryKeys.lexemes, queryFn: () => repositories.lexemes.list() })
  const close = useCallback(() => navigate('/training'), [navigate]); useTelegramBack(true, close)
  const answer = useMutation({ mutationFn: ({ wordId, grade }: { wordId: string; grade: ReviewGrade }) => repositories.reviews.answer(sessionId, wordId, grade), onSuccess: (next) => { queryClient.setQueryData(['session', sessionId], next); setRevealed(false); queryClient.invalidateQueries({ queryKey: queryKeys.profile }) } })
  const skipMissing = useMutation({ mutationFn: (wordId: string) => repositories.reviews.skipMissing(sessionId, wordId), onSuccess: (next) => queryClient.setQueryData(['session', sessionId], next) })
  useEffect(() => {
    const current = session.data
    if (!current || current.completed || !words.data || skipMissing.isPending) return
    const currentId = current.lexemeIds[current.cursor]
    if (currentId && !words.data.some((item) => item.id === currentId)) skipMissing.mutate(currentId)
  }, [session.data, skipMissing, words.data])
  if (session.isPending || words.isPending) return <Standalone><LoadingState label="Готовим карточки…" /></Standalone>
  if (session.isError || words.isError) return <Standalone><ErrorState error={session.error ?? words.error} /></Standalone>
  if (!session.data) return <Navigate to="/training" replace />
  if (session.data.completed) return <Standalone><div className="grid min-h-[80dvh] place-items-center"><div className="card w-full p-8 text-center"><span className="text-6xl">🎉</span><h1 className="page-title mt-4">Сессия завершена</h1><p className="muted mt-2">Повторено слов: {session.data.answers.length}</p><button className="button button-primary mt-6 w-full" onClick={close}>Вернуться в тренажёр</button></div></div></Standalone>
  const wordId = session.data.lexemeIds[session.data.cursor]; const word = words.data?.find((item) => item.id === wordId)
  if (!word) return <Standalone><LoadingState label="Пропускаем удалённую запись…" /></Standalone>
  const progress = Math.round((session.data.cursor / session.data.lexemeIds.length) * 100)
  return <Standalone><header className="flex items-center gap-3"><button className="button button-ghost icon-button" onClick={close} aria-label="Закрыть тренировку"><X /></button><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]"><div className="training-progress h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></div><span className="muted text-xs font-bold">{session.data.cursor + 1}/{session.data.lexemeIds.length}</span></header><div className="training-stage grid content-center"><article className="card p-7 text-center">{word.pos ? <span className={`pos-badge pos-${word.pos}`}>{posLabels[word.pos]}</span> : <span className="personal-badge">{word.kind === 'phrase' ? 'Фраза' : 'Моё слово'}</span>}<p className="font-arabic mt-10 text-7xl" dir="rtl">{word.word_ar}</p>{revealed && <div className="training-answer mt-8 border-t border-[var(--border)] pt-6"><p className="text-lg font-extrabold">{word.translations.join('; ')}</p>{word.details.root && <p className="muted font-arabic mt-3" dir="rtl">Корень: {word.details.root}</p>}{word.note && <p className="muted mt-3 text-sm">{word.note}</p>}</div>}</article>{!revealed ? <button className="button button-primary mt-4 w-full" onClick={() => setRevealed(true)}>Показать ответ</button> : <div className="training-grades mt-4 grid grid-cols-3 gap-2"><GradeButton label="Снова" grade="again" className="bg-rose-50 text-rose-700" onClick={(grade) => answer.mutate({ wordId, grade })} /><GradeButton label="Трудно" grade="hard" className="bg-amber-50 text-amber-700" onClick={(grade) => answer.mutate({ wordId, grade })} /><GradeButton label="Легко" grade="easy" className="bg-emerald-50 text-emerald-700" onClick={(grade) => answer.mutate({ wordId, grade })} /></div>}</div></Standalone>
}

function GradeButton({ label, grade, className, onClick }: { label: string; grade: ReviewGrade; className: string; onClick(grade: ReviewGrade): void }) { return <button className={`button ${className}`} onClick={() => onClick(grade)}>{label}</button> }

function ProfilePage() {
  const queryClient = useQueryClient(); const { user, isTelegram } = useTelegram(); const profile = useQuery({ queryKey: queryKeys.profile, queryFn: () => repositories.profile.get() })
  const [goalOpen, setGoalOpen] = useState(false); const [themeOpen, setThemeOpen] = useState(false); const [resetOpen, setResetOpen] = useState(false)
  const update = useMutation({ mutationFn: (patch: Partial<Profile>) => repositories.profile.update(patch), onSuccess: (next) => queryClient.setQueryData(queryKeys.profile, next) })
  if (profile.isPending) return <LoadingState />; if (profile.isError) return <ErrorState error={profile.error} />
  const value = profile.data
  return <><section className="card flex items-center gap-4 p-5">{user.photoUrl ? <img src={user.photoUrl} className="h-16 w-16 rounded-full object-cover" alt="" /> : <span className="accent-bg grid h-16 w-16 place-items-center rounded-full text-2xl font-black">{user.firstName[0]}</span>}<div><h2 className="text-xl font-black">{user.firstName || value.name}</h2><p className="muted text-sm">{user.username ? `@${user.username}` : isTelegram ? 'Данные из Telegram' : 'Режим предпросмотра'}</p></div></section><div className="mt-4 grid grid-cols-3 gap-2">{[['Серия', `${value.streak} дн.`], ['Повторено', value.reviewedTotal], ['Цель', value.dailyGoal]].map(([label, stat]) => <div className="card p-3 text-center" key={label}><strong className="block text-lg">{stat}</strong><span className="muted text-[10px] uppercase">{label}</span></div>)}</div>
    <section className="card mt-5 divide-y divide-[var(--border)] p-2">
      <SettingRow icon={<Bell />} label="Напоминания"><AppSwitch checked={value.notifications} onChange={(checked) => update.mutate({ notifications: checked })} label="Включить напоминания" /></SettingRow>
      <SettingButton icon={<BarChart3 />} label="Дневная цель" value={`${value.dailyGoal} слов`} onClick={() => setGoalOpen(true)} />
      <SettingButton icon={value.theme === 'dark' ? <Moon /> : <Sun />} label="Тема" value={{ telegram: 'Telegram', light: 'Светлая', dark: 'Тёмная' }[value.theme]} onClick={() => setThemeOpen(true)} />
    </section>
    <section className="card mt-5 p-5"><h2 className="flex items-center gap-2 font-extrabold"><Settings size={19} /> Цветовой акцент</h2><div className="mt-4 flex justify-between">{(['blue', 'emerald', 'purple', 'rose', 'amber'] as Accent[]).map((accent) => <button key={accent} onClick={() => update.mutate({ accent })} className="accent-choice" style={{ background: accentColor(accent) }} aria-label={`Акцент ${accent}`} aria-pressed={value.accent === accent}>{value.accent === accent && <Check className="mx-auto text-white" size={18} />}</button>)}</div></section>
    <button className="button button-secondary mt-5 w-full" onClick={() => setResetOpen(true)}><RotateCcw size={18} /> Сбросить демо-данные</button>
    {goalOpen && <ChoiceDialog title="Дневная цель" value={String(value.dailyGoal)} options={['10', '20', '30', '50'].map((goal) => [goal, `${goal} слов`])} onClose={() => setGoalOpen(false)} onChange={(goal) => { update.mutate({ dailyGoal: Number(goal) }); setGoalOpen(false) }} />}
    {themeOpen && <ChoiceDialog title="Тема интерфейса" value={value.theme} options={[['telegram', 'Как в Telegram'], ['light', 'Светлая'], ['dark', 'Тёмная']]} onClose={() => setThemeOpen(false)} onChange={(theme) => { update.mutate({ theme: theme as ThemePreference }); setThemeOpen(false) }} />}
    {resetOpen && <ConfirmDialog title="Сбросить демо-данные?" text="Будут удалены локальные колоды, личные слова, настройки и прогресс." confirmLabel="Сбросить" destructive onClose={() => setResetOpen(false)} onConfirm={() => { resetDemoData(); location.reload() }} />}
  </>
}

function SettingRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) { return <div className="flex min-h-15 items-center gap-3 px-3 py-2"><span className="accent">{icon}</span><span className="flex-1 font-bold">{label}</span>{children}</div> }
function SettingButton({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick(): void }) { return <button className="setting-button" onClick={onClick}><span className="accent">{icon}</span><span className="flex-1 text-left font-bold">{label}</span><span className="muted text-sm font-semibold">{value}</span><ChevronRight className="muted" size={18} /></button> }
function AppSwitch({ checked, onChange, label }: { checked: boolean; onChange(value: boolean): void; label: string }) { return <button type="button" className="app-switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button> }
function AppChoices({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange(value: string): void }) { return <fieldset><legend className="eyebrow mb-2">{label}</legend><div className="app-choices">{options.map(([id, text]) => <button type="button" key={id} className="app-choice" aria-pressed={value === id} onClick={() => onChange(id)}>{text}{value === id && <Check size={16} />}</button>)}</div></fieldset> }
function ChoiceDialog({ title, value, options, onClose, onChange }: { title: string; value: string; options: [string, string][]; onClose(): void; onChange(value: string): void }) { return <Dialog title={title} onClose={onClose}><div className="grid gap-2" role="radiogroup" aria-label={title}>{options.map(([id, label]) => <button className="choice-row" role="radio" aria-checked={value === id} key={id} onClick={() => onChange(id)}><span>{label}</span>{value === id && <Check size={18} />}</button>)}</div></Dialog> }
function accentColor(accent: Accent) { return { blue: '#2563eb', emerald: '#059669', purple: '#7c3aed', rose: '#e11d48', amber: '#d97706' }[accent] }

function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const titleId = useId(); const ref = useRef<HTMLDivElement>(null); const closeTimer = useRef<number | null>(null); const closingRef = useRef(false); const [closing, setClosing] = useState(false)
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 180)
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const appScroll = document.querySelector<HTMLElement>('.app-scroll')
    const previousAppOverflow = appScroll?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (appScroll) appScroll.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return }
      if (event.key !== 'Tab' || !ref.current) return
      const focusable = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (appScroll) appScroll.style.overflow = previousAppOverflow
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
      previous?.focus()
    }
  }, [requestClose])
  return createPortal(<div className="dialog-backdrop" data-state={closing ? 'closing' : 'open'} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}><div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="mb-5 flex items-center justify-between"><h2 id={titleId} className="text-xl font-black">{title}</h2><button className="button button-ghost icon-button" onClick={requestClose} aria-label="Закрыть"><X /></button></header>{children}</div></div>, document.querySelector('.app-viewport') ?? document.body)
}

function ConfirmDialog({ title, text, confirmLabel, destructive = false, onClose, onConfirm }: { title: string; text: string; confirmLabel: string; destructive?: boolean; onClose(): void; onConfirm(): void | Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState('')
  const confirm = async () => { setPending(true); setError(''); try { await onConfirm() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось выполнить действие'); setPending(false) } }
  return <Dialog title={title} onClose={onClose}><p className="muted text-sm leading-6">{text}</p>{error && <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">{error}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button className="button button-secondary" onClick={onClose} disabled={pending}>Отмена</button><button className={`button ${destructive ? 'danger-button' : 'button-primary'}`} onClick={confirm} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={18} /> : confirmLabel}</button></div></Dialog>
}

function Standalone({ children }: { children: ReactNode }) { const scrollRef = useRubberBand<HTMLDivElement>(); return <main ref={scrollRef} className="app-scroll"><div className="app-shell rubber-content route-content standalone-shell">{children}</div></main> }
function NotFound() { return <Standalone><EmptyState title="Страница не найдена" text="Вернитесь на главную страницу приложения." /><Link className="button button-primary mt-4 w-full no-underline" to="/">На главную</Link></Standalone> }
