import { AppIcon } from '../../components/AppIcon'
import { roles, taskContexts } from '../../types/analysis'
import type { Role, TaskContext } from '../../types/analysis'

const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  parent: 'Parent',
  teacher: 'Teacher',
}

const ROLE_ICONS: Record<Role, 'student' | 'parent' | 'teacher'> = {
  student: 'student',
  parent: 'parent',
  teacher: 'teacher',
}

const CONTEXT_LABELS: Record<TaskContext, string> = {
  timed: 'Timed',
  quiz: 'Quiz or test',
  homework: 'Homework',
  classwork: 'Classwork',
  lab: 'Lab or multi-step task',
  writing: 'Writing',
  reading: 'Reading-heavy',
}

interface TaskSetupFieldsProps {
  contextTags: TaskContext[]
  onContextToggle: (nextContext: TaskContext) => void
  onRoleChange: (nextRole: Role) => void
  role: Role
}

export function TaskSetupFields({
  contextTags,
  onContextToggle,
  onRoleChange,
  role,
}: TaskSetupFieldsProps) {
  return (
    <div className="task-setup-fields">
      <div className="field-label">
        <span className="field-label__title">Role-aware output</span>
        <p className="field-label__help">
          The results stay grounded in the same source materials, but the lead
          guidance shifts for students, parents, or teachers.
        </p>
      </div>

      <div className="segmented-group" role="tablist" aria-label="Role view">
        {roles.map((nextRole) => (
          <button
            key={nextRole}
            className={`segmented-choice${
              nextRole === role ? ' segmented-choice--active' : ''
            }`}
            type="button"
            onClick={() => onRoleChange(nextRole)}
          >
            <AppIcon name={ROLE_ICONS[nextRole]} className="button-icon" />
            {ROLE_LABELS[nextRole]}
          </button>
        ))}
      </div>

      <div className="field-label">
        <span className="field-label__title">Optional task context</span>
        <p className="field-label__help">
          Add just enough classroom context to help the analysis stay cautious
          about timing, assessment conditions, or multi-step work.
        </p>
      </div>

      <div className="toggle-group">
        {taskContexts.map((contextTag) => (
          <button
            key={contextTag}
            className={`toggle-chip${
              contextTags.includes(contextTag) ? ' toggle-chip--active' : ''
            }`}
            type="button"
            onClick={() => onContextToggle(contextTag)}
          >
            <AppIcon name="waypoint" className="button-icon button-icon--sm" />
            {CONTEXT_LABELS[contextTag]}
          </button>
        ))}
      </div>
    </div>
  )
}
