import { Builtins, Cli } from 'clipanion'
import { VERSION } from './version'
import { CopyCommand } from './commands/copy'
import { DetectCommand } from './commands/detect'
import { DoctorCommand } from './commands/doctor'
import { InitCommand } from './commands/init'
import { LintCommand } from './commands/lint'
import { PublishCommand } from './commands/publish'
import { RenderCommand } from './commands/render'
import { ThemesCommand } from './commands/themes'

export function createCli(): Cli {
  const cli = new Cli({
    binaryLabel: `Welight CLI`,
    binaryName: `welight`,
    binaryVersion: VERSION,
  })

  cli.register(RenderCommand)
  cli.register(CopyCommand)
  cli.register(PublishCommand)
  cli.register(LintCommand)
  cli.register(DetectCommand)
  cli.register(ThemesCommand)
  cli.register(DoctorCommand)
  cli.register(InitCommand)

  cli.register(Builtins.HelpCommand)
  cli.register(Builtins.VersionCommand)

  return cli
}

export async function run(argv: string[]): Promise<void> {
  const cli = createCli()
  await cli.runExit(argv, Cli.defaultContext)
}
