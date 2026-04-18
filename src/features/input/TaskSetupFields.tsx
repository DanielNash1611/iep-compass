import { AppIcon } from '../../components/AppIcon'
import { taskContexts } from '../../types/analysis'
import type { TaskContext } from '../../types/analysis'

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
}

export function TaskSetupFields({
  contextTags,
  onContextToggle,
}: TaskSetupFieldsProps) {
  return (
    <div className="task-setup-fields">
      <div className="field-label">
        <span className="field-label__title">Helpful task tags</span>
        <p className="field-label__help">
          Add a tag only if it makes this task easier to understand, like timing,
          reading load, or multi-step directions.
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
