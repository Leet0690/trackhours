import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, GraduationCap, LayoutDashboard, ListFilter, Menu, Pencil, Plus, Sparkles, Trash2, TrendingUp, Wallet, X } from 'lucide-react'
import { firebaseReady, removeAttendance, saveAttendance, saveForecastSettings, subscribeAttendances, subscribeForecastSettings } from './firebase'
import ForecastPage from './ForecastPage'
import { defaultForecastSettings } from './forecast'
import './forecast.css'

const schools = { MIAGE: { rate: 75, color: '#366c60', soft: '#e5f0eb' }, ECIG: { rate: 70, color: '#cd8a53', soft: '#f7ecdf' } }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const money = n => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(n).replace('MAD', 'DH')
const hoursLabel = n => `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`
const dateLabel = s => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
const currentMonth = today().slice(0, 7)
const monthLabel = m => new Date(`${m}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
const initials = name => name === 'MIAGE' ? 'MI' : 'EC'

function App() {
  const [rows, setRows] = useState([])
  const [month, setMonth] = useState(currentMonth)
  const [filterSchool, setFilterSchool] = useState('Tous les établissements')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ school: 'MIAGE', date: today(), duration: '1.5' })
  const [custom, setCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [activePage, setActivePage] = useState('overview')
  const [forecastSettings, setForecastSettings] = useState(defaultForecastSettings)
  const [forecastSettingsLoaded, setForecastSettingsLoaded] = useState(false)

  useEffect(() => subscribeAttendances(setRows, () => setToast('Connexion Firebase interrompue.')), [])
  useEffect(() => subscribeForecastSettings(value => {
    if (value) setForecastSettings(current => JSON.stringify(current) === JSON.stringify(value) ? current : value)
    setForecastSettingsLoaded(true)
  }, () => setToast('Impossible de charger le calendrier prévisionnel.')), [])
  useEffect(() => {
    if (!forecastSettingsLoaded) return
    const timer = setTimeout(() => saveForecastSettings(forecastSettings).catch(() => setToast('Impossible d’enregistrer le calendrier prévisionnel.')), 450)
    return () => clearTimeout(timer)
  }, [forecastSettings, forecastSettingsLoaded])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast])

  const monthly = useMemo(() => rows.filter(r => r.date.startsWith(month)), [rows, month])
  const visible = useMemo(() => monthly.filter(r => filterSchool === 'Tous les établissements' || r.school === filterSchool), [monthly, filterSchool])
  const totals = useMemo(() => Object.fromEntries(Object.keys(schools).map(name => {
    const list = monthly.filter(r => r.school === name)
    const hours = list.reduce((sum, r) => sum + Number(r.duration), 0)
    return [name, { hours, count: list.length, amount: hours * schools[name].rate }]
  })), [monthly])
  const grandTotal = totals.MIAGE.amount + totals.ECIG.amount
  const chartData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - (5 - i)); const key = d.toISOString().slice(0, 7)
    const list = rows.filter(r => r.date.startsWith(key))
    return { name: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), MIAGE: list.filter(r => r.school === 'MIAGE').reduce((a, r) => a + Number(r.duration) * 75, 0), ECIG: list.filter(r => r.school === 'ECIG').reduce((a, r) => a + Number(r.duration) * 70, 0) }
  }), [rows, month])

  function openNew() { setEditing(null); setForm({ school: 'MIAGE', date: today(), duration: '1.5' }); setCustom(false); setModal(true) }
  function openEdit(row) { setEditing(row); setForm({ school: row.school, date: row.date, duration: String(row.duration) }); setCustom(!['1.5', '3'].includes(String(row.duration))); setModal(true) }
  async function submit(e) {
    e.preventDefault(); const duration = Number(form.duration)
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24) return setToast('Saisissez une durée entre 0 et 24 heures.')
    setSaving(true)
    try { await saveAttendance({ id: editing?.id || crypto.randomUUID(), school: form.school, date: form.date, duration }); setModal(false); setToast(editing ? 'Présence mise à jour.' : 'Présence ajoutée.') }
    catch { setToast('Enregistrement impossible. Vérifiez la configuration Firebase.') }
    finally { setSaving(false) }
  }
  async function deleteRow(row) {
    if (!window.confirm(`Supprimer la présence ${row.school} du ${dateLabel(row.date)} (${hoursLabel(row.duration)}) ?`)) return
    try { await removeAttendance(row.id); setToast('Présence supprimée.') } catch { setToast('Suppression impossible.') }
  }
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const data = visible.map(r => ({ Date: dateLabel(r.date), Établissement: r.school, Durée: Number(r.duration), 'Tarif horaire (DH)': schools[r.school].rate, 'Honoraires (DH)': Number(r.duration) * schools[r.school].rate }))
    const filteredTotals = Object.fromEntries(Object.keys(schools).map(s => { const list = visible.filter(r => r.school === s); const hours = list.reduce((a, r) => a + Number(r.duration), 0); return [s, { count: list.length, hours, amount: hours * schools[s].rate }] }))
    const summary = [['Récapitulatif', monthLabel(month)], ['Filtre établissement', filterSchool], [], ['Établissement', 'Présences', 'Heures', 'Tarif (DH/h)', 'Total (DH)'], ...Object.keys(schools).filter(s => filterSchool === 'Tous les établissements' || filterSchool === s).map(s => [s, filteredTotals[s].count, filteredTotals[s].hours, schools[s].rate, filteredTotals[s].amount]), ['TOTAL', visible.length, visible.reduce((a, r) => a + Number(r.duration), 0), '', visible.reduce((a, r) => a + Number(r.duration) * schools[r.school].rate, 0)]]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Récapitulatif'); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Présences filtrées'); XLSX.writeFile(wb, `presences-${month}${filterSchool !== 'Tous les établissements' ? `-${filterSchool.toLowerCase()}` : ''}.xlsx`)
    setToast('Export Excel téléchargé.')
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><GraduationCap size={20} strokeWidth={2.2} /></div><span>heures<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">ESPACE DE TRAVAIL</div>
      <nav><button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => { setActivePage('overview'); setMobileMenu(false) }}><LayoutDashboard size={18} /><span>Vue d’ensemble</span></button><button className={`nav-item ${activePage === 'attendance' ? 'active' : ''}`} onClick={() => { setActivePage('attendance'); setMobileMenu(false); setTimeout(() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><CalendarDays size={18} /><span>Présences</span><span className="nav-count">{rows.length}</span></button><button className={`nav-item ${activePage === 'forecast' ? 'active' : ''}`} onClick={() => { setActivePage('forecast'); setMobileMenu(false) }}><TrendingUp size={18} /><span>Prévisions</span></button></nav>
      <div className="sidebar-rule" />
      <div className="workspace-label school-label">ÉTABLISSEMENTS</div>
      {Object.entries(schools).map(([name, data]) => <button className="school-nav" key={name} onClick={() => { setFilterSchool(name); setActivePage('attendance'); setTimeout(() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' }), 0) }}><span className="school-icon" style={{ background: data.soft, color: data.color }}>{initials(name)}</span><span>{name}</span><span className="rate-tag">{data.rate} DH</span></button>)}
      <div className="sidebar-bottom"><div className="help-icon"><Sparkles size={17} /></div><div><strong>Un coup de main ?</strong><span>Votre suivi, tout simplement.</span></div><ArrowRight size={16} className="help-arrow" /></div>
    </aside>
    {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button><div className="breadcrumb">Espace personnel <span>/</span> <b>{activePage === 'forecast' ? 'Prévisions' : activePage === 'attendance' ? 'Présences' : 'Vue d’ensemble'}</b></div><div className="topbar-right"><span className={`sync-indicator ${firebaseReady ? 'synced' : ''}`}><i />{firebaseReady ? 'Synchronisé' : 'Mode local'}</span><div className="avatar">S</div></div></header>
      <div className="content">
        {activePage === 'forecast' ? <ForecastPage rows={rows} month={month} setMonth={setMonth} schools={schools} money={money} settings={forecastSettings} onSettingsChange={setForecastSettings} /> : <>
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> VOTRE ACTIVITÉ</div><h1>Bonjour, bienvenue <span className="wave">✳</span></h1><p>Voici le résumé de vos présences et honoraires.</p></div><button className="primary-button" onClick={openNew}><Plus size={18} strokeWidth={2.5} /> Ajouter une présence</button></section>
        {!firebaseReady && <div className="setup-notice"><div className="notice-icon"><Sparkles size={16} /></div><div><b>Mode local activé</b><span>Configurez Firebase pour synchroniser vos données dans le cloud.</span></div><a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Configurer <ArrowRight size={14} /></a></div>}
        <section className="stats-row">
          <div className="stat-card total-card"><div className="stat-top"><span className="stat-label">HONORAIRES DU MOIS</span><span className="stat-icon wallet-icon"><Wallet size={17} /></span></div><div className="stat-value">{money(grandTotal)}</div><div className="stat-foot"><span className="foot-dot green-dot" /> {monthLabel(month)} <span className="muted">· {totals.MIAGE.count + totals.ECIG.count} présences</span></div><div className="total-accent" /></div>
          {Object.entries(schools).map(([name, info]) => <div className="stat-card school-card" key={name}><div className="stat-top"><span className="stat-label">{name}</span><span className="stat-icon" style={{ background: info.soft, color: info.color }}><GraduationCap size={17} /></span></div><div className="school-amount">{money(totals[name].amount)}</div><div className="school-metrics"><span><b>{hoursLabel(totals[name].hours)}</b> travaillées</span><span className="metric-sep" /><span><b>{totals[name].count}</b> présences</span></div><div className="rate-caption">{info.rate} DH <span>/ heure</span></div></div>)}
          <div className="stat-card hours-card"><div className="stat-top"><span className="stat-label">TEMPS TRAVAILLÉ</span><span className="stat-icon clock-icon"><Clock3 size={17} /></span></div><div className="stat-value">{hoursLabel(totals.MIAGE.hours + totals.ECIG.hours)}</div><div className="stat-foot"><span className="muted">Sur {monthLabel(month)}</span></div><div className="hours-progress"><i style={{ width: `${Math.min(100, (totals.MIAGE.hours + totals.ECIG.hours) / 80 * 100)}%` }} /></div></div>
        </section>
        <section className="overview-grid">
          <div className="panel chart-panel"><div className="panel-heading"><div><h2>Évolution des honoraires</h2><p>Suivi mensuel par établissement</p></div><div className="legend"><span><i className="legend-miage" /> MIAGE</span><span><i className="legend-ecig" /> ECIG</span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={6} barCategoryGap="29%"><CartesianGrid vertical={false} stroke="#edf0eb" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#98a19a', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#98a19a', fontSize: 11 }} tickFormatter={v => `${v}`} width={34} /><Tooltip cursor={{ fill: '#f5f6f2' }} formatter={v => [money(v), '']} contentStyle={{ border: '1px solid #edf0eb', borderRadius: 12, fontFamily: 'DM Sans', fontSize: 12 }} /><Bar dataKey="MIAGE" name="MIAGE" fill={schools.MIAGE.color} radius={[5, 5, 0, 0]} maxBarSize={24} /><Bar dataKey="ECIG" name="ECIG" fill={schools.ECIG.color} radius={[5, 5, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div></div>
          <div className="panel month-panel"><div className="panel-heading"><div><h2>Ce mois-ci</h2><p>Votre répartition d’activité</p></div><div className="mini-calendar"><CalendarDays size={16} /></div></div><div className="month-total">{hoursLabel(totals.MIAGE.hours + totals.ECIG.hours)}<span>au total</span></div><div className="distribution"><div className="distribution-title"><span>Répartition des heures</span><b>{totals.MIAGE.hours + totals.ECIG.hours ? '100%' : '0%'}</b></div><div className="distribution-bar"><i style={{ width: `${(totals.MIAGE.hours + totals.ECIG.hours) ? totals.MIAGE.hours / (totals.MIAGE.hours + totals.ECIG.hours) * 100 : 0}%` }} /><i style={{ width: `${(totals.MIAGE.hours + totals.ECIG.hours) ? totals.ECIG.hours / (totals.MIAGE.hours + totals.ECIG.hours) * 100 : 0}%` }} /></div>{Object.entries(schools).map(([name, info]) => <div className="breakdown-row" key={name}><span><i style={{ background: info.color }} />{name}</span><b>{hoursLabel(totals[name].hours)}</b></div>)}</div><div className="month-footer"><span>Tarifs horaires fixes</span><b>75 <small>/</small> 70 DH</b></div></div>
        </section>
        <section className="panel history-panel" id="history"><div className="history-header"><div><div className="history-title"><h2>Historique des présences</h2><span className="record-count">{visible.length}</span></div><p>Consultez et gérez vos heures effectuées.</p></div><button className="export-button" onClick={exportExcel}><ArrowDownToLine size={16} /> Exporter Excel</button></div><div className="filters"><label className="filter-control"><CalendarDays size={16} /><span className="month-text">{monthLabel(month)}</span><ChevronDown size={14} /><input type="month" aria-label="Filtrer par mois" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label><label className="filter-control"><ListFilter size={16} /><span className="school-filter-text">{filterSchool}</span><select aria-label="Filtrer par établissement" value={filterSchool} onChange={e => setFilterSchool(e.target.value)}><option>Tous les établissements</option><option>MIAGE</option><option>ECIG</option></select><ChevronDown size={14} /></label><span className="filter-result">{visible.length} résultat{visible.length !== 1 ? 's' : ''}</span></div>
          <div className="table-wrap"><table><thead><tr><th>DATE</th><th>ÉTABLISSEMENT</th><th>DURÉE</th><th>TARIF HORAIRE</th><th>HONORAIRES</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.length ? visible.map(row => <tr className="attendance-row" key={row.id}><td data-label="Date"><span className="date-cell">{dateLabel(row.date)}</span></td><td data-label="Établissement"><span className="school-pill"><i style={{ background: schools[row.school].color }} />{row.school}</span></td><td data-label="Durée"><span className="duration-cell"><Clock3 size={14} />{hoursLabel(row.duration)}</span></td><td data-label="Tarif horaire" className="rate-cell">{schools[row.school].rate} DH <span>/ h</span></td><td data-label="Honoraires" className="amount-cell">{money(Number(row.duration) * schools[row.school].rate)}</td><td data-label="Actions"><div className="row-actions"><button title="Modifier" aria-label="Modifier" onClick={() => openEdit(row)}><Pencil size={15} /></button><button title="Supprimer" aria-label="Supprimer" onClick={() => deleteRow(row)}><Trash2 size={15} /></button></div></td></tr>) : <tr className="empty-row"><td colSpan="6"><div className="empty-state"><div className="empty-icon"><CalendarDays size={20} /></div><b>Aucune présence pour cette période</b><span>Ajoutez une présence pour commencer votre suivi.</span><button onClick={openNew}><Plus size={15} /> Ajouter une présence</button></div></td></tr>}</tbody></table></div>
          <div className="table-footer"><span>Montants calculés automatiquement au tarif de chaque établissement.</span><div>Total filtré <b>{money(visible.reduce((sum, r) => sum + Number(r.duration) * schools[r.school].rate, 0))}</b></div></div>
        </section>
        <footer className="page-footer"><span>© {new Date().getFullYear()} Heures. <i /> Suivi des présences</span><span>MIAGE <b>75 DH/h</b><i /> ECIG <b>70 DH/h</b></span></footer>
        </>}
      </div>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}><form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow"><span className="eyebrow-line" /> NOUVELLE SAISIE</span><h2>{editing ? 'Modifier la présence' : 'Ajouter une présence'}</h2></div><button type="button" className="close-button" onClick={() => setModal(false)}><X size={19} /></button></div><label className="form-label">Établissement</label><div className="school-choice">{Object.entries(schools).map(([name, info]) => <button type="button" key={name} className={form.school === name ? 'choice selected' : 'choice'} onClick={() => setForm({ ...form, school: name })}><span className="school-icon" style={{ background: info.soft, color: info.color }}>{initials(name)}</span><span><b>{name}</b><small>{info.rate} DH / heure</small></span>{form.school === name && <Check size={17} />}</button>)}</div><label className="form-label" htmlFor="date">Date de présence</label><input className="form-input" id="date" type="date" required max={today()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /><div className="form-label duration-label">Durée <span>Choix rapide ou personnalisé</span></div><div className="duration-choices">{['1.5', '3'].map(v => <button type="button" key={v} className={!custom && form.duration === v ? 'duration-choice selected' : 'duration-choice'} onClick={() => { setCustom(false); setForm({ ...form, duration: v }) }}><Clock3 size={15} /> {v.replace('.', ',')} h</button>)}<button type="button" className={custom ? 'duration-choice selected' : 'duration-choice'} onClick={() => { setCustom(true); setForm({ ...form, duration: custom ? form.duration : '' }) }}>Autre durée</button></div>{custom && <div className="custom-duration"><input className="form-input" type="number" min="0.25" max="24" step="0.25" required placeholder="Ex. 2,5" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /><span>heures</span></div>}<div className="fee-preview"><span>Honoraires estimés</span><b>{money((Number(form.duration) || 0) * schools[form.school].rate)}</b><small>{form.duration || '0'} h × {schools[form.school].rate} DH/h</small></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModal(false)}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : <><Plus size={17} /> Ajouter la présence</>}</button></div></form></div>}
    {toast && <div className="toast"><Check size={16} />{toast}</div>}
  </div>
}

export default App
