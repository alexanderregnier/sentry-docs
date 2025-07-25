'use client';

import {ReactNode, useContext, useEffect, useReducer, useState} from 'react';
import {QuestionMarkCircledIcon} from '@radix-ui/react-icons';
import * as Tooltip from '@radix-ui/react-tooltip';
import {Button, Checkbox, Theme} from '@radix-ui/themes';

import styles from './styles.module.scss';

import {CodeContext} from '../codeContext';

const optionDetails: Record<
  OptionId,
  {
    description: ReactNode;
    name: string;
    deps?: OptionId[];
  }
> = {
  'error-monitoring': {
    name: 'Error Monitoring',
    description: "Let's admit it, we all have errors.",
  },
  performance: {
    name: 'Tracing',
    description: (
      <span>
        Tracing and automatic performance issue detection across services and context on
        who is impacted, outliers, regressions, and the root cause of your slowdown.
      </span>
    ),
  },
  profiling: {
    name: 'Profiling',
    description: (
      <span>
        <span className={styles.TooltipTitle}>Requires Tracing to be enabled</span>
        See the exact lines of code causing your performance bottlenecks, for faster
        troubleshooting and resource optimization.
      </span>
    ),
    deps: ['performance'],
  },
  'session-replay': {
    name: 'Session Replay',
    description: (
      <span>
        Video-like reproductions of user sessions with debugging context to help you
        confirm issue impact and troubleshoot faster.
      </span>
    ),
  },
  'user-feedback': {
    name: 'User Feedback',
    description: (
      <span>
        Collect user feedback from anywhere in your application with an embeddable widget
        that allows users to report bugs and provide insights.
      </span>
    ),
  },
  logs: {
    name: 'Logs (Beta)',
    description: (
      <span>
        Send text-based log information from your applications to Sentry for viewing
        alongside relevant errors and searching by text-string or individual attributes.
      </span>
    ),
  },
  'source-context': {
    name: 'Source Context',
    description: (
      <span>
        Upload your source code to allow Sentry to display snippets of your code next to
        the event stack traces.
      </span>
    ),
  },
  dsym: {
    name: 'dSYM',
    description: (
      <span>
        Debug symbols for iOS and macOS that provide the necessary information to convert
        program addresses back to function names, source file names, and line numbers.
      </span>
    ),
  },
  'source-maps': {
    name: 'Source Maps',
    description: (
      <span>
        Source maps for web applications that help translate minified code back to the
        original source for better error reporting.
      </span>
    ),
  },
  opentelemetry: {
    name: 'OpenTelemetry',
    description: <span>Combine Sentry with OpenTelemetry.</span>,
  },
};

const OPTION_IDS = [
  'error-monitoring',
  'performance',
  'profiling',
  'session-replay',
  'user-feedback',
  'logs',
  'source-context',
  'dsym',
  'source-maps',
  'opentelemetry',
] as const;

type OptionId = (typeof OPTION_IDS)[number];

export type OnboardingOptionType = {
  /**
   * Unique identifier for the option, will control the visibility
   * of `<OnboardingOption optionId="this_id"` /> somewhere on the page
   * or lines of code specified in in a `{onboardingOptions: {this_id: 'line-range'}}` in a code block meta
   */
  id: OptionId;
  /**
   * defaults to `true`
   */
  checked?: boolean;
  disabled?: boolean;
};

const validateOptionIds = (options: Pick<OnboardingOptionType, 'id'>[]) => {
  options.forEach(option => {
    if (!OPTION_IDS.includes(option.id)) {
      throw new Error(
        `Invalid option id: ${option.id}.\nValid options are: ${OPTION_IDS.map(opt => `"${opt}"`).join(', ')}`
      );
    }
  });
};

export function OnboardingOption({
  children,
  optionId = 'all',
  hideForThisOption,
  isStep = false,
}: {
  children: ReactNode;
  optionId: OptionId | 'all';
  hideForThisOption?: boolean;
  isStep?: boolean;
}) {
  if (optionId !== 'all') {
    // Allow not passing an optionId when isStep is true
    validateOptionIds([{id: optionId}]);
  }
  const className = [hideForThisOption ? 'hidden' : '', isStep ? 'onboarding-step' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-onboarding-option={optionId}
      data-hide-for-this-option={hideForThisOption}
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * Wrapper component that provides CSS counter context for numbered onboarding steps
 * @param children - OnboardingOption components that should be numbered as steps
 */
export function OnboardingSteps({children}: {children: ReactNode}) {
  return <div className="onboarding-steps">{children}</div>;
}

/**
 * Updates DOM elements' visibility based on selected onboarding options
 */
export function updateElementsVisibilityForOptions(
  options: OnboardingOptionType[],
  touchedOptions: boolean
) {
  options.forEach(option => {
    if (option.disabled) {
      return;
    }
    const targetElements = document.querySelectorAll<HTMLDivElement>(
      `[data-onboarding-option="${option.id}"]`
    );

    targetElements.forEach(el => {
      const hiddenForThisOption = el.dataset.hideForThisOption === 'true';
      if (hiddenForThisOption) {
        el.classList.toggle('hidden', option.checked);
      } else {
        el.classList.toggle('hidden', !option.checked);
      }
      // only animate things when user has interacted with the options
      if (touchedOptions) {
        if (el.classList.contains('code-line')) {
          el.classList.toggle('animate-line', option.checked);
        }
        // animate content, account for inverted logic for hiding
        else {
          el.classList.toggle(
            'animate-content',
            hiddenForThisOption ? !option.checked : option.checked
          );
        }
      }
    });
    if (option.checked && optionDetails[option.id].deps?.length) {
      const dependenciesSelector = optionDetails[option.id].deps!.map(
        dep => `[data-onboarding-option="${dep}"]`
      );
      const dependencies = document.querySelectorAll<HTMLDivElement>(
        dependenciesSelector.join(', ')
      );

      dependencies.forEach(dep => {
        dep.classList.remove('hidden');
      });
    }
  });
}

export function OnboardingOptionButtons({
  options: initialOptions,
}: {
  // convenience to allow passing option ids as strings when no additional config is required
  options: (OnboardingOptionType | OptionId)[];
}) {
  const codeContext = useContext(CodeContext);

  const normalizedOptions = initialOptions.map(option => {
    if (typeof option === 'string') {
      return {
        id: option,
        // error monitoring is always needs to be checked and disabled
        disabled: option === 'error-monitoring',
        checked: option === 'error-monitoring',
      };
    }
    return option;
  });

  validateOptionIds(normalizedOptions);

  const [options, setSelectedOptions] = useState<OnboardingOptionType[]>(
    normalizedOptions.map(option => ({
      ...option,
      // default to unchecked if not excplicitly set
      checked: option.checked ?? false,
    }))
  );
  const [touchedOptions, touchOptions] = useReducer(() => true, false);

  function handleCheckedChange(clickedOption: OnboardingOptionType, checked: boolean) {
    touchOptions();
    const dependencies = optionDetails[clickedOption.id].deps ?? [];
    const depenedants =
      options.filter(opt => optionDetails[opt.id].deps?.includes(clickedOption.id)) ?? [];
    setSelectedOptions(prev => {
      // - select option and all dependencies
      // - disable dependencies
      if (checked) {
        return prev.map(opt => {
          if (opt.id === clickedOption.id) {
            return {
              ...opt,
              checked: true,
            };
          }
          if (dependencies.includes(opt.id)) {
            return {...opt, checked: true};
          }
          return opt;
        });
      }
      // unselect option and all dependants
      // Note: does not account for dependencies of multiple dependants
      return prev.map(opt => {
        if (opt.id === clickedOption.id) {
          return {
            ...opt,
            checked: false,
          };
        }
        // deselect dependants
        if (depenedants.find(dep => dep.id === opt.id)) {
          return {...opt, checked: false};
        }
        return opt;
      });
    });
  }

  // sync local state to global
  useEffect(() => {
    codeContext?.updateOnboardingOptions(options);
  }, [options, codeContext]);

  useEffect(() => {
    updateElementsVisibilityForOptions(options, touchedOptions);
  }, [options, touchOptions, touchedOptions]);

  return (
    <div className="onboarding-options flex flex-wrap gap-3 py-2 bg-[var(--white)] dark:bg-[var(--gray-1)]  sticky top-[80px] z-[4] shadow-[var(--shadow-6)] transition">
      {options.map(option => (
        <Button
          variant="surface"
          size={{
            xs: '3',
            md: '2',
          }}
          disabled={option.disabled}
          asChild
          key={option.id}
          className="w-full md:w-auto"
        >
          <label role="button">
            <Checkbox
              defaultChecked={option.disabled}
              checked={option.checked}
              disabled={option.disabled}
              variant="soft"
              size="1"
              onCheckedChange={ev => {
                handleCheckedChange(option, ev as boolean);
              }}
            />

            {optionDetails[option.id].name}
            {optionDetails[option.id] && (
              <Tooltip.Provider delayDuration={300}>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    asChild
                    onMouseEnter={e => {
                      // Explicit mouse enter handling for Firefox compatibility
                      e.currentTarget.setAttribute('data-state', 'delayed-open');
                    }}
                    onMouseLeave={e => {
                      // Explicit mouse leave handling for Firefox compatibility
                      e.currentTarget.removeAttribute('data-state');
                    }}
                    onFocus={e => {
                      // Ensure keyboard navigation works
                      e.currentTarget.setAttribute('data-state', 'delayed-open');
                    }}
                    onBlur={e => {
                      // Ensure keyboard navigation works
                      e.currentTarget.removeAttribute('data-state');
                    }}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Help: ${optionDetails[option.id].name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'help',
                        outline: 'none',
                      }}
                    >
                      <QuestionMarkCircledIcon fontSize={20} strokeWidth="2" />
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Theme accentColor="iris">
                      <Tooltip.Content
                        className={styles.TooltipContent}
                        sideOffset={5}
                        align="center"
                        side="top"
                      >
                        {optionDetails[option.id].description}
                        <Tooltip.Arrow className={styles.TooltipArrow} />
                      </Tooltip.Content>
                    </Theme>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
          </label>
        </Button>
      ))}
    </div>
  );
}
