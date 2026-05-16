import { AppIcon } from '../../components/AppIcon'
import { taskContexts } from '../../types/analysis'
import type { TaskContext } from '../../types/analysis'

const CONTEXT_LABELS: Record<TaskContext, string> = {
  timed: 'Timed',
  quiz: 'Quiz or test',
  homework: 'Homework',
  classwork: 'Classwork',
  lab: 'Multi-step task',
  writing: 'Lots of writing',
  reading: 'Lots of reading',
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
        <span className="field-label__title">Tags (optional)</span>
        <p className="field-label__help">
          Tap any tags that describe this school work. You can skip this.
        </p>
      </div>

      <div className="toggle-group">
        {taskContexts.map((contextTag) => (
          <button
            key={contextTag}
            aria-pressed={contextTags.includes(contextTag)}
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
