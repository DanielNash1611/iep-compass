import { SectionCard } from '../../components/SectionCard'
import { roles, taskContexts } from '../../types/analysis'
import type { Role, TaskContext } from '../../types/analysis'

const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  parent: 'Parent',
  teacher: 'Teacher',
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

interface TaskInputProps {
  contextTags: TaskContext[]
  onContextToggle: (nextContext: TaskContext) => void
  onRoleChange: (nextRole: Role) => void
  onTaskTextChange: (nextValue: string) => void
  role: Role
  taskText: string
}

export function TaskInput({
  contextTags,
  onContextToggle,
  onRoleChange,
  onTaskTextChange,
  role,
  taskText,
}: TaskInputProps) {
  return (
    <SectionCard
      eyebrow="Step 2"
      title="Describe the task, worksheet, quiz, or assessment"
      description="Add only the classroom task details. This app maps supports to the task and will not answer the work itself."
    >
      <div className="field-stack">
        <div className="field-label">
          <span className="field-label__title">Role-aware view</span>
          <p className="field-label__help">
            The result emphasizes different sections for students, parents, and
            teachers without changing the safety rules.
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
              {ROLE_LABELS[nextRole]}
            </button>
          ))}
        </div>

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
          <span className="field-label__title">Optional task context</span>
          <p className="field-label__help">
            These tags help the analysis stay cautious about time, assessment
            conditions, and multi-step work.
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
