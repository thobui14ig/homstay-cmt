import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CookieEntity, CookieStatus } from '../../domain/entity/cookie.entity';

@Injectable()
export class CookieService {
  constructor(
    @InjectRepository(CookieEntity)
    private repo: Repository<CookieEntity>,
  ) { }

  findOne(id: number) {
    return this.repo.findOne({
      where: {
        id
      }
    })
  }

  async getCookieActiveFromDb(): Promise<CookieEntity> {
    const cookies = await this.repo.find({
      where: {
        status: In([CookieStatus.INACTIVE, CookieStatus.ACTIVE]),
        user: {
          level: 1
        }
      },
      relations: {
        user: true
      },
    })
    const randomIndex = Math.floor(Math.random() * cookies.length);
    const randomCookie = cookies[randomIndex];

    return randomCookie
  }

  updateStatusCookie(cookie: CookieEntity, status: CookieStatus) {
    return this.repo.save({ ...cookie, status })
  }

  async updateActiveAllCookie() {
    const allCookie = await this.repo.find({
      where: {
        status: CookieStatus.LIMIT,
        user: {
          level: 1
        }
      },
      relations: {
        user: true
      },
    })

    return this.repo.save(allCookie.map((item) => {
      return {
        ...item,
        status: CookieStatus.ACTIVE,
      }
    }))
  }

  deleteCookieDie() {
    return this.repo.delete({ status: CookieStatus.DIE })
  }
}
