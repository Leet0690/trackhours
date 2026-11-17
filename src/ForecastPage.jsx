import { useMemo, useState } from 'react'
import { CalendarDays, CalendarOff, Clock3, Plus, Trash2, TrendingUp } from 'lucide-react'
import { calculateMonthlyForecast, defaultForecastSettings, moroccoFixedHolidays, weekdayIds, weekdayLabels } from './forecast'

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export default function ForecastPage({ rows, month, setMonth, schools, money, settings, onSettingsChange }) {
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', school: 'Tous' })
  const forecast = useMemo(() => calculateMonthlyForecast({ month, today: today(), rows, settings, schools }), [month, rows, settings, schools])
  const nationalHolidays = useMemo(() => moroccoFixedHolidays(Number(month.slice(0, 4))).filter(day => day.date.startsWith(month)), [month])
  const customHolidays = useMemo(() => settings.holidays.filter(day => day.date.startsWith(month)), [settings.holidays, month])
  const holidayList = [...nationalHolidays, ...customHolidays].sort((a, b) => a.date.localeCompare(b.date))
  const totals = forecast.reduce((total, school) => ({
    actual: total.actual + school.actualAmount,
    projected: total.projected + school.projectedAmount,
    total: total.total + school.totalAmount,
    days: total.days + school.expectedDays,
  }), { actual: 0, projected: 0, total: 0, days: 0 })

  function updateSchool(name, changes) {
    const current = settings.schools[name] || defaultForecastSettings.schools[name]
    onSettingsChange({ ...settings, schools: { ...settings.schools, [name]: { ...current, ...changes } } })
  }

  function toggleWeekday(name, weekday) {
    const current = settings.schools[name] || defaultForecastSettings.schools[name]
    const weekdays = current.weekdays.includes(weekday)
      ? current.weekdays.filter(day => day !== weekday)
      : [...current.weekdays, weekday].sort((a, b) => weekdayIds.indexOf(a) - weekdayIds.indexOf(b))
    updateSchool(name, { weekdays })
  }

  function addHoliday(event) {
    event.preventDefault()
    const knownNationalHolidays = moroccoFixedHolidays(Number(holidayForm.date.slice(0, 4)))
    const sameDate = [...knownNationalHolidays, ...settings.holidays].some(day => day.date === holidayForm.date && (day.school === holidayForm.school || day.school === 'Tous' || holidayForm.school === 'Tous'))
    if (!holidayForm.date || sameDate) return
    onSettingsChange({ ...settings, holidays: [...settings.holidays, { ...holidayForm, name: holidayForm.name.trim() || 'Fermeture de l’établissement', id: crypto.randomUUID() }] })
    setMonth(holidayForm.date.slice(0, 7))
    setHolidayForm({ date: '', name: '', school: holidayForm.school })
  }

  function removeHoliday(id) {
    onSettingsChange({ ...settings, holidays: settings.holidays.filter(holiday => holiday.id !== id) })
  }

  const monthHeading = new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return <>
    <section className="page-heading forecast-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> PRÉVISION MENSUELLE</div><h1>Prévision des honoraires</h1><p>Estimez les revenus selon le calendrier de chaque école.</p></div>
      <label className="forecast-month"><CalendarDays size={17} /><span>{monthHeading}</span><input type="month" aria-label="Mois à prévoir" value={month} onChange={event => event.target.value && setMonth(event.target.value)} /></label>
    </section>

    <section className="forecast-summary panel">
      <div className="forecast-summary-intro"><span className="forecast-summary-icon"><TrendingUp size={18} /></span><div><span className="stat-label">REVENU ESTIMÉ EN {monthHeading.toUpperCase()}</span><strong>{money(totals.total)}</strong><small>Revenu déjà enregistré + jours de travail à venir</small></div></div>
      <div className="forecast-summary-metrics"><div><span>Déjà enregistré</span><b>{money(totals.actual)}</b></div><div><span>Jours de travail à venir</span><b>{totals.days}</b></div><div><span>Revenu prévisionnel restant</span><b>{money(totals.projected)}</b></div></div>
    </section>

    <section className="forecast-school-grid">
      {forecast.map(item => {
        const info = schools[item.name]
        const schedule = settings.schools[item.name] || defaultForecastSettings.schools[item.name]
        return <article className="panel forecast-school-card" key={item.name}>
          <div className="forecast-school-title"><span className="school-icon" style={{ background: info.soft, color: info.color }}>{item.name.slice(0, 2)}</span><div><h2>{item.name}</h2><span>{item.rate} DH / heure</span></div><div className="forecast-total">{money(item.totalAmount)}<small>estimés</small></div></div>
          <div className="forecast-breakdown"><div><span>Jours travaillés prévus</span><b>{item.workDays}</b></div><div><span>Jours à venir comptés</span><b>{item.expectedDays}</b></div><div><span>Honoraires enregistrés</span><b>{money(item.actualAmount)}</b></div></div>
          <div className="forecast-settings"><div className="forecast-setting-title"><span>Jours de travail</span><small>Choisissez ceux de {item.name}</small></div><div className="weekday-picker" aria-label={`Jours travaillés pour ${item.name}`}>
            {weekdayLabels.map((label, index) => {
              const day = weekdayIds[index]
              const selected = schedule.weekdays.includes(day)
              return <button key={label} type="button" className={selected ? 'weekday-chip selected' : 'weekday-chip'} aria-pressed={selected} onClick={() => toggleWeekday(item.name, day)}>{label}</button>
            })}
          </div>
          <label className="hours-per-day"><span><Clock3 size={15} /> Heures prévues par jour</span><span className="hours-input-wrap"><input type="number" min="0" max="24" step="0.25" value={schedule.hoursPerDay} onChange={event => updateSchool(item.name, { hoursPerDay: event.target.value === '' ? '' : Math.min(24, Math.max(0, Number(event.target.value))) })} onBlur={() => { if (schedule.hoursPerDay === '') updateSchool(item.name, { hoursPerDay: 1.5 }) }} aria-label={`Heures prévues par jour à ${item.name}`} /><small>h</small></span></label>
          </div>
        </article>
      })}
    </section>

    <section className="panel holiday-panel">
      <div className="holiday-heading"><div><h2>Jours fériés et fermetures</h2><p>Les jours nationaux fixes sont exclus automatiquement. Ajoutez les fermetures propres aux écoles et les fêtes mobiles.</p></div><span className="holiday-icon"><CalendarOff size={17} /></span></div>
      <form className="holiday-form" onSubmit={addHoliday}>
        <label><span>Date</span><input type="date" required value={holidayForm.date} onChange={event => setHolidayForm({ ...holidayForm, date: event.target.value })} /></label>
        <label><span>Nom (facultatif)</span><input type="text" maxLength="60" placeholder="Ex. vacances scolaires" value={holidayForm.name} onChange={event => setHolidayForm({ ...holidayForm, name: event.target.value })} /></label>
        <label><span>Établissement</span><select value={holidayForm.school} onChange={event => setHolidayForm({ ...holidayForm, school: event.target.value })}><option value="Tous">Les deux écoles</option>{Object.keys(schools).map(name => <option key={name}>{name}</option>)}</select></label>
        <button className="holiday-add" type="submit"><Plus size={16} /> Ajouter</button>
      </form>
      <div className="holiday-list-title">Jours non travaillés en {monthHeading}</div>
      {holidayList.length ? <div className="holiday-list">{holidayList.map((holiday, index) => <div className="holiday-row" key={holiday.id || `${holiday.date}-${holiday.name}-${index}`}><span className="holiday-date">{dateLabel(holiday.date)}</span><span className="holiday-name">{holiday.name}{holiday.national && <small>Jour férié national</small>}</span><span className="holiday-school">{holiday.school === 'Tous' ? 'Les deux écoles' : holiday.school}</span>{holiday.national ? <span className="holiday-auto">Automatique</span> : <button type="button" className="holiday-remove" title="Supprimer cette fermeture" aria-label={`Supprimer ${holiday.name}`} onClick={() => removeHoliday(holiday.id)}><Trash2 size={15} /></button>}</div>)}</div> : <div className="holiday-empty">Aucun jour férié mobile ou fermeture ajouté pour ce mois.</div>}
    </section>

    <p className="forecast-note">La prévision utilise les présences enregistrées, les jours sélectionnés, les jours fériés et vos heures prévues par journée. Vérifiez les fêtes mobiles et les calendriers propres à chaque école.</p>
  </>
}
