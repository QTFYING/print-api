import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { SampleProcessor } from './queues/sample.processor';
import workerConfiguration from './config/worker.configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [workerConfiguration] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        pinoHttp: {
          level: cs.get('LOG_LEVEL', 'info'),
          ...(process.env.NODE_ENV !== 'production'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
  ],
  providers: [SampleProcessor],
})
export class WorkerModule {}
