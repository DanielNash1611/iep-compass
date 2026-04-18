import { SectionCard } from '../../components/SectionCard'
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

interface TaskInputProps {
  contextTags: TaskContext[]
  onContextToggle: (nextContext: TaskContext) => void
  onTaskTextChange: (nextValue: string) => void
  taskText: string
}

export function TaskInput({
  contextTags,
  onContextToggle,
  onTaskTextChange,
  taskText,
}: TaskInputProps) {
  return (
    <SectionCard
      eyebrow="Step 2"
      title="Describe the task, worksheet, quiz, or assessment"
      description="Add only the classroom task details. This app maps accommodations to the task and will not answer the work itself."
    >
      <div className="field-stack">
        <label className="textarea-label">
          <span className="field-label__title">Task text</span>
          <textarea
            className="textarea-input textarea-input--compact"
            name="taskText"
            placeholder="Paste directions, describe what the assignment asks, or summarize the visible parts of a worksheet photo."
            value={taskText}
            onChange={(event) => onTaskTextChange(event.target.value)}
          />
        </label>

        <div className="field-label">
          <span className="field-label__title">Helpful task tags</span>
          <p className="field-label__help">
            Add a tag only if it makes the task easier to understand.
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
              {CONTEXT_LABELS[contextTag]}
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
