import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {SearchService} from '../app.service';
import {IdSearchResponseDTO, ObjectToRelation, TextSearchResponseDTO, WallPost} from '../proto-gen/search_pb';
import {catchError, switchMap} from 'rxjs/operators';
import {throwError, zip} from 'rxjs';
import {Edge, Node} from '@swimlane/ngx-graph';
import {ActivatedRoute} from '@angular/router';
import {AuthService} from '../auth.service';
import {vkOpenAuthDialogURL} from '../const';
import {VkGroupsResponse, VkSearchService, VkUsersResponse} from '../vk-search.service';

interface GraphData {
  edges: Edge[];
  graphNodes: Node[];
}

@Component({
  selector: 'app-root',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent implements OnInit{
  title = 'Search';
  searchForm: FormGroup;
  textResponse: TextSearchResponseDTO.AsObject;
  graphsData: GraphData[] = [];

  groupIds: string[] = [];
  userIds: string[] = [];

  groupsMap: {[key: string]: VkGroupsResponse} = {};
  usersMap: {[key: string]: VkUsersResponse} = {};

  showTextResponse = false;
  showIdResponse = false;

  page: number;
  size: number;

  vkOpenAuthURL = vkOpenAuthDialogURL;

  constructor(
    private searchService: SearchService,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private vkSearchService: VkSearchService) {
    this.searchForm = new FormGroup({
      texttosearch: new FormControl(''),
      searchWithId: new FormControl('')
    });
  }

  ngOnInit() {
    const vkCode = this.activatedRoute.snapshot.queryParams.code;
    console.log(vkCode);
    if (vkCode && vkCode !== '') {
      this.authService.getAccessToken(vkCode).pipe(catchError(error => {
        return throwError(error);
      })).subscribe(vkAccessResponse => console.log(vkAccessResponse));
    } else {
      window.location.href = this.vkOpenAuthURL;
    }
  }

  search() {
    if (this.searchForm.value.searchWithId) {
      this.searchWithId();
    } else {
      this.searchWithText();
    }
  }

  searchWithText() {
    this.searchService.searchWithText(this.searchForm.value.texttosearch)
      .pipe(
        switchMap((result) => {
          console.log(result);
          this.textResponse = result;
          this.showTextResponse = true;
          this.showIdResponse = false;
          this.graphsData = this.getGraphsFromTextResponse(result);
          this.getUsersAndGroupsIds(result.contentList);
          console.log(this.groupIds, this.userIds.join(','));
          return zip(this.vkSearchService.getGroups(this.groupIds.join(',')), this.vkSearchService.getUsers(this.userIds.join(',')));
        }  ),
        catchError(error => {
          return throwError(error);
        }
        )
      ).subscribe(([groupsMap, usersMap]) => {
        this.groupsMap = groupsMap;
        this.usersMap = usersMap;
    });
  }

  searchWithId() {
    const id = '/id' + this.searchForm.value.texttosearch;

    this.searchService.searchWithId(id)
      .pipe(
        switchMap(result => {
          console.log(result);
          this.showTextResponse = false;
          this.showIdResponse = true;
          this.userIds = [];
          this.groupIds = [];
          this.graphsData = this.getGraphFormIdResponse(result);
          console.log(this.graphsData);
          if (result.fromid.toString().includes('-')) {
            this.groupIds.push(result.fromid.toString().replace('-', ''));
          } else {
            this.userIds.push(result.fromid.toString());
          }
          return zip(this.vkSearchService.getGroups(this.groupIds.join(',')), this.vkSearchService.getUsers(this.userIds.join(',')));
        }),
        catchError(error => {
          return throwError(error);
        }
        )
      ).subscribe(([groupsMap, usersMap]) => {
      this.groupsMap = groupsMap;
      this.usersMap = usersMap;
    });
  }

  getGraphFormIdResponse(response: IdSearchResponseDTO.AsObject): GraphData[] {
    const graphData: GraphData[] = [];
    graphData.push(this.getEdgesAndNodes(response.relationmapList));
    return graphData;
  }

  getGraphsFromTextResponse(response: TextSearchResponseDTO.AsObject): GraphData[] {
    const graphData: GraphData[] = [];

    response.contentList.forEach((wallPost: WallPost.AsObject) => {
      graphData.push(this.getEdgesAndNodes(wallPost.relationmapList));
    });
    return graphData;
  }

  getEdgesAndNodes(item: ObjectToRelation.AsObject[]) {
    const links: Edge[] = [];
    const nodes: Node[] = [{id: 'author', label: 'author'}];
    item.forEach((relation: ObjectToRelation.AsObject, index) => {
      links.push({
        id: `link${index}`,
        source: 'author',
        target: relation.object,
        label: relation.relation
      });

      nodes.push({
        id: relation.object,
        label: relation.object
      });
    });

    return {edges: links, graphNodes: nodes};
  }


  getUsersAndGroupsIds(result: WallPost.AsObject[]) {
    const groupsIds = [];
    const usersIds = [];
    result.forEach((post: WallPost.AsObject) => {
      if (post.fromid.toString().includes('-')) {
        groupsIds.push(post.fromid.toString().replace('-', ''));
      } else {
        usersIds.push(post.fromid.toString());
      }
    });
    this.groupIds = Array.from(new Set(groupsIds));
    this.userIds = Array.from(new Set(usersIds));
  }
}